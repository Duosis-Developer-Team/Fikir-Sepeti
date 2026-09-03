import { NextResponse } from "next/server";
import { resolveIdentity, getDb, userHasPermission } from "@/lib/server-auth";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (body.status !== "open" && body.status !== "done") {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  const sb = getDb(req);
  const { data: existing } = await sb
    .from("suggestions")
    .select("id, tenant_id")
    .eq("id", id)
    .maybeSingle();
  if (!existing || existing.tenant_id !== identity.tenantId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Tamamlandı işaretlemek öneriyi atanın değil, adminin işi — sahiplik istisnası yok.
  const canManage = await userHasPermission(
    identity.tenantId,
    identity.userId,
    "tenant.manage_settings",
    req
  );
  if (!canManage) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { data, error } = await sb
    .from("suggestions")
    .update({ status: body.status })
    .eq("id", id)
    .select()
    .single();
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "update_failed" }, { status: 500 });
  }

  const suggestion = data.anonymous ? { ...data, created_by: null } : data;
  return NextResponse.json({ suggestion });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const sb = getDb(req);
  const { data: existing } = await sb
    .from("suggestions")
    .select("id, tenant_id, created_by")
    .eq("id", id)
    .maybeSingle();
  if (!existing || existing.tenant_id !== identity.tenantId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const isOwner = existing.created_by === identity.email;
  if (!isOwner) {
    const canManage = await userHasPermission(
      identity.tenantId,
      identity.userId,
      "tenant.manage_settings",
      req
    );
    if (!canManage) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const { error } = await sb.from("suggestions").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
