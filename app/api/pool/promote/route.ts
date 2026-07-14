import { NextResponse } from "next/server";
import {
  resolveIdentity,
  supabaseAdmin,
  userHasPermission,
} from "@/lib/server-auth";
import type { BasketType } from "@/lib/types";

export async function POST(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const allowed = await userHasPermission(
    identity.tenantId,
    identity.userId,
    "pool.promote"
  );
  if (!allowed) {
    return NextResponse.json({ error: "forbidden", permission: "pool.promote" }, { status: 403 });
  }

  let body: {
    pool_idea_ids?: string[];
    type?: BasketType;
    title?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const ids = body.pool_idea_ids?.filter(Boolean) ?? [];
  const type = body.type ?? "hackathon";
  const title = body.title?.trim() ?? "";
  if (!ids.length || title.length < 2) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const createPerm = type === "hackathon" ? "hackathon.create" : "etkinlik.create";
  const canCreate = await userHasPermission(
    identity.tenantId,
    identity.userId,
    createPerm
  );
  if (!canCreate) {
    return NextResponse.json({ error: "forbidden", permission: createPerm }, { status: 403 });
  }

  const sb = supabaseAdmin();
  const { data: poolRows, error: pErr } = await sb
    .from("idea_pool")
    .select("*")
    .eq("tenant_id", identity.tenantId)
    .in("id", ids);

  if (pErr || !poolRows?.length) {
    return NextResponse.json({ error: "ideas_not_found" }, { status: 404 });
  }

  const primary = poolRows[0];
  const isHackathon = type === "hackathon";

  const { data: basket, error: bErr } = await sb
    .from("baskets")
    .insert({
      title,
      type,
      resolve_method: "vote",
      phase: isHackathon ? "lobby" : "ideas",
      created_by: identity.email,
      tenant_id: identity.tenantId,
      config: isHackathon
        ? {
            ideaSource: "repo",
            repoPoolIdeaId: primary.id as string,
          }
        : {},
    })
    .select()
    .single();

  if (bErr || !basket) {
    return NextResponse.json({ error: bErr?.message ?? "basket_failed" }, { status: 500 });
  }

  // Copy pool texts into basket ideas (etkinlik always; hackathon repo keeps primary selected)
  const ideaInserts = poolRows.map((row) => ({
    basket_id: basket.id,
    text: row.text as string,
    tag: (row.category as string) || null,
    created_by: row.created_by as string,
    tenant_id: identity.tenantId,
    vote_count: 0,
  }));
  const { data: ideas, error: iErr } = await sb.from("ideas").insert(ideaInserts).select();
  if (iErr) {
    return NextResponse.json({ error: iErr.message }, { status: 500 });
  }

  if (isHackathon && ideas?.[0]) {
    await sb
      .from("baskets")
      .update({ selected_idea_id: ideas[0].id })
      .eq("id", basket.id);
  }

  await sb
    .from("idea_pool")
    .update({
      status: "promoted",
      promoted_basket_id: basket.id,
    })
    .in("id", ids);

  if (isHackathon) {
    const { data: orgRole } = await sb
      .from("roles")
      .select("id")
      .eq("key", "organizer")
      .is("tenant_id", null)
      .maybeSingle();
    if (orgRole) {
      const { data: existing } = await sb
        .from("user_roles")
        .select("id")
        .eq("tenant_id", identity.tenantId)
        .eq("user_id", identity.userId)
        .eq("role_id", orgRole.id)
        .is("scope_basket_id", null)
        .maybeSingle();
      if (!existing) {
        await sb.from("user_roles").insert({
          tenant_id: identity.tenantId,
          user_id: identity.userId,
          role_id: orgRole.id,
          scope_basket_id: null,
        });
      }
    }
  }

  return NextResponse.json({ basketId: basket.id, basket }, { status: 200 });
}
