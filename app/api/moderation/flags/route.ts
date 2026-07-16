import { NextResponse } from "next/server";
import {
  resolveIdentity,
  getDb,
  userHasPermission,
} from "@/lib/server-auth";
import { writeAudit } from "@/lib/server-moderation";

/** GET /api/moderation/flags — pending queue (content.moderate). */
export async function GET(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const can = await userHasPermission(
    identity.tenantId,
    identity.userId,
    "content.moderate",
    req);
  if (!can) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const status = new URL(req.url).searchParams.get("status") ?? "pending";
  const sb = getDb(req);
  const { data, error } = await sb
    .from("content_flags")
    .select("*")
    .eq("tenant_id", identity.tenantId)
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ flags: data ?? [] });
}

/**
 * PATCH /api/moderation/flags
 * body: { id, decision: 'approve' | 'hide' }
 */
export async function PATCH(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const can = await userHasPermission(
    identity.tenantId,
    identity.userId,
    "content.moderate",
    req);
  if (!can) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    id?: string;
    decision?: "approve" | "hide";
  };
  if (!body.id || (body.decision !== "approve" && body.decision !== "hide")) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const sb = getDb(req);
  const { data: flag, error: fetchErr } = await sb
    .from("content_flags")
    .select("*")
    .eq("id", body.id)
    .eq("tenant_id", identity.tenantId)
    .maybeSingle();

  if (fetchErr || !flag) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const nextStatus = body.decision === "hide" ? "hidden" : "approved";
  await sb
    .from("content_flags")
    .update({ status: nextStatus, reviewed_by: identity.email })
    .eq("id", body.id);

  const entityType = flag.entity_type as string;
  const entityId = flag.entity_id as string;
  const hidden = body.decision === "hide";

  if (entityType === "idea") {
    await sb.from("ideas").update({ hidden }).eq("id", entityId);
  } else if (entityType === "pool") {
    await sb.from("idea_pool").update({ hidden }).eq("id", entityId);
  } else if (entityType === "feedback") {
    await sb.from("feedback").update({ hidden }).eq("id", entityId);
  }

  await writeAudit(sb, {
    tenant_id: identity.tenantId,
    actor: identity.email,
    action: hidden ? "moderation.hide" : "moderation.approve",
    entity_type: entityType,
    entity_id: entityId,
    meta: { flag_id: body.id },
  });

  return NextResponse.json({ ok: true, status: nextStatus });
}
