import { NextResponse } from "next/server";
import {
  resolveIdentity,
  getDb,
  userHasPermission,
} from "@/lib/server-auth";
import type { BasketType, ResolveMethod } from "@/lib/types";

export async function POST(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    title?: string;
    type?: BasketType;
    resolve_method?: ResolveMethod;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const title = body.title?.trim() ?? "";
  const type = body.type ?? "etkinlik";
  if (title.length < 2) {
    return NextResponse.json({ error: "title_required" }, { status: 400 });
  }

  const permission = type === "hackathon" ? "hackathon.create" : "etkinlik.create";
  const allowed = await userHasPermission(
    identity.tenantId,
    identity.userId,
    permission,
    req);
  if (!allowed) {
    return NextResponse.json({ error: "forbidden", permission }, { status: 403 });
  }

  const isHackathon = type === "hackathon";
  const sb = getDb(req);
  const { data, error } = await sb
    .from("baskets")
    .insert({
      title,
      type,
      resolve_method: isHackathon ? "vote" : body.resolve_method ?? "vote",
      phase: isHackathon ? "lobby" : "ideas",
      created_by: identity.email,
      tenant_id: identity.tenantId,
      config: {},
    })
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "insert_failed" }, { status: 500 });
  }

  // Only hackathon creators become organizers (etkinlik must not elevate to hackathon.create)
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

  return NextResponse.json({ basket: data }, { status: 200 });
}

export async function PATCH(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { basket_id?: string; title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const title = body.title?.trim() ?? "";
  if (!body.basket_id || title.length < 2) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const sb = getDb(req);
  const { data: basket } = await sb
    .from("baskets")
    .select("id, tenant_id, type, created_by")
    .eq("id", body.basket_id)
    .maybeSingle();
  if (!basket || basket.tenant_id !== identity.tenantId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const isCreator = basket.created_by === identity.email;
  if (!isCreator) {
    const canManage = await userHasPermission(
      identity.tenantId,
      identity.userId,
      "hackathon.manage",
      req
    );
    if (!canManage) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const { data, error } = await sb
    .from("baskets")
    .update({ title })
    .eq("id", body.basket_id)
    .select()
    .single();
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "update_failed" }, { status: 500 });
  }
  return NextResponse.json({ basket: data });
}
