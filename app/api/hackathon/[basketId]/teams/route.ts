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
  const canManage =
    basket.created_by === identity.email ||
    (await userHasPermission(identity.tenantId, identity.userId, "hackathon.manage", basketId, req));

  const tenantId = identity.tenantId;

  // Takım adını organizatör dışında sadece o takımın (rastgele atanan) lideri değiştirebilir.
  if (body.action === "rename") {
    const { teamId, name } = body as Extract<Action, { action: "rename" }>;
    if (!canManage) {
      const { data: team } = await sb
        .from("teams")
        .select("leader_user_id")
        .eq("id", teamId)
        .eq("basket_id", basketId)
        .maybeSingle();
      // team_members.user_id (ve dolayısıyla leader_user_id) identity.userId taşıyor,
      // e-posta değil — ama bazı akışlarda üyelik e-postayla da yazılabiliyor, ikisini de kontrol et.
      const isLeader =
        !!team && (team.leader_user_id === identity.userId || team.leader_user_id === identity.email);
      if (!isLeader) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 });
      }
    }
    await sb.from("teams").update({ name: name?.trim() || "Takım" }).eq("id", teamId).eq("basket_id", basketId);
    return NextResponse.json({ ok: true });
  }

  if (!canManage) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  if (body.action === "rebuild") {
    const spec = (body as Extract<Action, { action: "rebuild" }>).teams ?? [];
    // Sıfırdan kurma: mevcut takımlar silinir (team_members cascade ile gider).
    await sb.from("teams").delete().eq("basket_id", basketId);
    for (const t of spec) {
      // Rastgele/otomatik dağıtımda üyelerden biri lider olur — takım adını
      // sonradan sadece o (ya da organizatör) değiştirebilir.
      const leaderUserId = t.members.length
        ? t.members[Math.floor(Math.random() * t.members.length)]
        : null;
      const { data: team } = await sb
        .from("teams")
        .insert({ basket_id: basketId, tenant_id: tenantId, name: t.name, leader_user_id: leaderUserId })
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

  if (body.action === "angle") {
    const { teamId, angle } = body as Extract<Action, { action: "angle" }>;
    await sb.from("teams").update({ angle: angle?.trim() || null }).eq("id", teamId).eq("basket_id", basketId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
