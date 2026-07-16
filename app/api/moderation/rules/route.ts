import { NextResponse } from "next/server";
import {
  resolveIdentity,
  supabaseAdmin,
  userHasPermission,
} from "@/lib/server-auth";
import { writeAudit } from "@/lib/server-moderation";

async function canManageRules(tenantId: string, userId: string) {
  const a = await userHasPermission(tenantId, userId, "tenant.manage_settings");
  if (a) return true;
  return userHasPermission(tenantId, userId, "content.moderate");
}

/** GET /api/moderation/rules */
export async function GET(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("content_rules")
    .select("*")
    .eq("tenant_id", identity.tenantId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ rules: data ?? [] });
}

/** POST /api/moderation/rules — create rule (default action=warn). */
export async function POST(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!(await canManageRules(identity.tenantId, identity.userId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    pattern?: string;
    kind?: "word" | "regex";
    action?: "warn" | "block";
  };
  const pattern = body.pattern?.trim() ?? "";
  if (pattern.length < 1) {
    return NextResponse.json({ error: "pattern_required" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("content_rules")
    .insert({
      tenant_id: identity.tenantId,
      pattern,
      kind: body.kind === "regex" ? "regex" : "word",
      action: body.action === "block" ? "block" : "warn",
      enabled: true,
    })
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "insert_failed" }, { status: 500 });
  }

  await writeAudit(sb, {
    tenant_id: identity.tenantId,
    actor: identity.email,
    action: "rule.create",
    entity_type: "content_rule",
    entity_id: data.id as string,
    meta: { pattern, action: data.action },
  });

  return NextResponse.json({ rule: data });
}

/** PATCH /api/moderation/rules — update by id in body. */
export async function PATCH(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!(await canManageRules(identity.tenantId, identity.userId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    id?: string;
    pattern?: string;
    kind?: "word" | "regex";
    action?: "warn" | "block";
    enabled?: boolean;
  };
  if (!body.id) {
    return NextResponse.json({ error: "id_required" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.pattern !== undefined) patch.pattern = body.pattern.trim();
  if (body.kind !== undefined) patch.kind = body.kind;
  if (body.action !== undefined) patch.action = body.action;
  if (body.enabled !== undefined) patch.enabled = body.enabled;

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("content_rules")
    .update(patch)
    .eq("id", body.id)
    .eq("tenant_id", identity.tenantId)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "not_found" }, { status: 404 });
  }

  await writeAudit(sb, {
    tenant_id: identity.tenantId,
    actor: identity.email,
    action: "rule.update",
    entity_type: "content_rule",
    entity_id: data.id as string,
    meta: patch,
  });

  return NextResponse.json({ rule: data });
}

/** DELETE /api/moderation/rules?id= */
export async function DELETE(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!(await canManageRules(identity.tenantId, identity.userId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id_required" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { error } = await sb
    .from("content_rules")
    .delete()
    .eq("id", id)
    .eq("tenant_id", identity.tenantId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await writeAudit(sb, {
    tenant_id: identity.tenantId,
    actor: identity.email,
    action: "rule.delete",
    entity_type: "content_rule",
    entity_id: id,
  });

  return NextResponse.json({ ok: true });
}
