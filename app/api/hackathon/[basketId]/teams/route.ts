import { NextResponse } from "next/server";
import { getDb, resolveIdentity, userHasPermission } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Action =
  | { action: "rebuild"; teams: { name: string; members: string[] }[] }
  | { action: "assignIdeas"; pairs: { teamId: string; ideaId: string }[] }
  | { action: "rename"; teamId: string; name: string }
  | { action: "angle"; teamId: string; angle: string };

/** Takım kurma/atama işlemleri — hepsi organizatör yetkisi ister. */
export async function POST(req: Request, ctx: { params: Promise<{ basketId: string }> }) {
  const identity = await resolveIdentity(req);
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { basketId } = await ctx.params;

  const body = (await req.json().catch(() => ({}))) as Partial<Action>;
  const sb = getDb(req);

  const { data: basket } = await sb
    .from("baskets")
    .select("id, tenant_id, created_by")
    .eq("id", basketId)
    .maybeSingle();
  if (!basket || basket.tenant_id !== identity.tenantId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (basket.created_by !== identity.email) {
    const canManage = await userHasPermission(
      identity.tenantId, identity.userId, "hackathon.manage", basketId, req
    );
    if (!canManage) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const tenantId = identity.tenantId;

  if (body.action === "rebuild") {
    const spec = (body as Extract<Action, { action: "rebuild" }>).teams ?? [];
    // Sıfırdan kurma: mevcut takımlar silinir (team_members cascade ile gider).
    await sb.from("teams").delete().eq("basket_id", basketId);
    for (const t of spec) {
      const { data: team } = await sb
        .from("teams")
        .insert({ basket_id: basketId, tenant_id: tenantId, name: t.name })
        .select()
        .single();
      if (team && t.members.length) {
        await sb.from("team_members").insert(
          t.members.map((uid) => ({
            team_id: team.id,
            basket_id: basketId,
            tenant_id: tenantId,
            user_id: uid,
          }))
        );
      }
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "assignIdeas") {
    const pairs = (body as Extract<Action, { action: "assignIdeas" }>).pairs ?? [];
    for (const p of pairs) {
      await sb.from("teams").update({ idea_id: p.ideaId }).eq("id", p.teamId).eq("basket_id", basketId);
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "rename") {
    const { teamId, name } = body as Extract<Action, { action: "rename" }>;
    await sb.from("teams").update({ name: name?.trim() || "Takım" }).eq("id", teamId).eq("basket_id", basketId);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "angle") {
    const { teamId, angle } = body as Extract<Action, { action: "angle" }>;
    await sb.from("teams").update({ angle: angle?.trim() || null }).eq("id", teamId).eq("basket_id", basketId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
