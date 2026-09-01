import { NextResponse } from "next/server";
import { getDb, resolveIdentity } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Demo fazında kişi başı tek oy — değiştirilebilir.
 *
 * Kendi takımına oy verememe kuralı eskiden SADECE arayüzde vardı (DemoStage
 * butonu disable ediyordu); istekle doğrudan atlanabiliyordu. Artık sunucuda.
 * Tek takım varsa istisna korunuyor (karşılaştıracak başka takım yok).
 */
export async function POST(req: Request, ctx: { params: Promise<{ basketId: string }> }) {
  const identity = await resolveIdentity(req);
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { basketId } = await ctx.params;

  const { team_id } = (await req.json().catch(() => ({}))) as { team_id?: string };
  if (!team_id) return NextResponse.json({ error: "team_id required" }, { status: 400 });

  const sb = getDb(req);
  const { data: team } = await sb
    .from("teams")
    .select("id, basket_id, tenant_id")
    .eq("id", team_id)
    .maybeSingle();
  if (!team || team.basket_id !== basketId || team.tenant_id !== identity.tenantId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: allTeams } = await sb.from("teams").select("id").eq("basket_id", basketId);
  const { data: mine } = await sb
    .from("team_members")
    .select("team_id")
    .eq("basket_id", basketId)
    .eq("user_id", identity.userId)
    .maybeSingle();

  if ((allTeams ?? []).length > 1 && mine?.team_id === team_id) {
    return NextResponse.json({ error: "own_team" }, { status: 403 });
  }

  await sb.from("team_votes").delete().eq("basket_id", basketId).eq("voter", identity.email);
  const { error } = await sb.from("team_votes").insert({
    team_id,
    basket_id: basketId,
    voter: identity.email,
    tenant_id: identity.tenantId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
