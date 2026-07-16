import { NextResponse } from "next/server";
import {
  resolveIdentity,
  supabaseAdmin,
  userHasPermission,
} from "@/lib/server-auth";

export async function GET(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("idea_pool")
    .select("*")
    .eq("tenant_id", identity.tenantId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ideas: data ?? [] });
}

export async function POST(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const allowed = await userHasPermission(
    identity.tenantId,
    identity.userId,
    "pool.create"
  );
  if (!allowed) {
    return NextResponse.json({ error: "forbidden", permission: "pool.create" }, { status: 403 });
  }

  let body: {
    text?: string;
    brief?: string | null;
    category?: string | null;
    track_hint?: "hackathon" | "etkinlik" | null;
    poll_closes_at?: string | null;
    status?: string;
    acknowledge?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const text = body.text?.trim() ?? "";
  if (text.length < 2) {
    return NextResponse.json({ error: "text_required" }, { status: 400 });
  }

  const { createFlags, evaluateText, writeAudit } = await import(
    "@/lib/server-moderation"
  );
  const { warnMessage } = await import("@/lib/moderation");
  const sb = supabaseAdmin();
  const check = await evaluateText(sb, identity.tenantId, text);
  if (check.action === "block") {
    return NextResponse.json(
      { error: "blocked", hits: check.hits },
      { status: 422 }
    );
  }
  if (check.action === "warn" && !body.acknowledge) {
    return NextResponse.json(
      {
        error: "warn",
        message: warnMessage(check.hits),
        hits: check.hits,
      },
      { status: 409 }
    );
  }

  const status =
    body.poll_closes_at || body.status === "voting" ? "voting" : body.status === "new" ? "new" : body.poll_closes_at ? "voting" : "new";

  const { data, error } = await sb
    .from("idea_pool")
    .insert({
      tenant_id: identity.tenantId,
      text,
      brief: body.brief?.trim() || null,
      category: body.category?.trim() || null,
      track_hint: body.track_hint ?? null,
      status,
      created_by: identity.email,
      poll_closes_at: body.poll_closes_at ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "insert_failed" }, { status: 500 });
  }

  if (check.hits.length) {
    await createFlags(sb, {
      tenant_id: identity.tenantId,
      entity_type: "pool",
      entity_id: data.id as string,
      created_by: identity.email,
      hits: check.hits.map((h) => ({ ruleId: h.ruleId, matched: h.matched })),
    });
    await writeAudit(sb, {
      tenant_id: identity.tenantId,
      actor: identity.email,
      action: "content.warn_submit",
      entity_type: "pool",
      entity_id: data.id as string,
    });
  }

  return NextResponse.json({ idea: data }, { status: 200 });
}
