import { NextResponse } from "next/server";
import { resolveIdentity, getDb, userHasPermission } from "@/lib/server-auth";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(req: Request, ctx: Ctx) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const sb = getDb(req);
  const { data: idea } = await sb
    .from("idea_pool")
    .select("id, tenant_id, created_by")
    .eq("id", id)
    .maybeSingle();
  if (!idea || idea.tenant_id !== identity.tenantId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const isOwner = idea.created_by === identity.email;
  if (!isOwner) {
    const canModerate = await userHasPermission(
      identity.tenantId,
      identity.userId,
      "content.moderate",
      req
    );
    if (!canModerate) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const { error } = await sb.from("idea_pool").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
