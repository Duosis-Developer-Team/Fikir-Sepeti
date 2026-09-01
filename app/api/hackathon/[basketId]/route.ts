import { NextResponse } from "next/server";
import { getDb, resolveIdentity, userHasPermission } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hackathon veri paketi.
 *
 * HackathonRunner eskiden 7 ayrı Supabase sorgusunu tarayıcıdan PARALEL
 * atıyordu ve realtime her olayda hepsini tekrar atıyordu. Tek uca indirildi:
 * 7 ağ turu → 1. Sorgular sunucuda yine paralel koşuyor.
 */
async function loadBundle(req: Request, basketId: string, tenantId: string) {
  const sb = getDb(req);
  const [basket, ideas, participants, teams, members, teamVotes, scores] = await Promise.all([
    sb.from("baskets").select("*").eq("id", basketId).eq("tenant_id", tenantId).maybeSingle(),
    sb.from("ideas").select("*").eq("basket_id", basketId).order("vote_count", { ascending: false }),
    sb.from("hackathon_participants").select("*").eq("basket_id", basketId).order("joined_at", { ascending: true }),
    sb.from("teams").select("*").eq("basket_id", basketId).order("created_at", { ascending: true }),
    sb.from("team_members").select("*").eq("basket_id", basketId),
    sb.from("team_votes").select("*").eq("basket_id", basketId),
    sb.from("scores").select("*").eq("basket_id", basketId),
  ]);

  if (!basket.data) return null;
  return {
    basket: basket.data,
    ideas: ideas.data ?? [],
    participants: participants.data ?? [],
    teams: teams.data ?? [],
    members: members.data ?? [],
    teamVotes: teamVotes.data ?? [],
    scores: scores.data ?? [],
  };
}

export async function GET(req: Request, ctx: { params: Promise<{ basketId: string }> }) {
  const identity = await resolveIdentity(req);
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { basketId } = await ctx.params;

  const bundle = await loadBundle(req, basketId, identity.tenantId);
  if (!bundle) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(bundle);
}

/**
 * PATCH — sepet üzerindeki tüm hackathon mutasyonları tek uçta.
 *
 * Bunlar eskiden istemciden doğrudan `supabase.from("baskets").update(...)`
 * ile yapılıyordu; RLS tenant sınırını koruyordu ama SEPET SAHİPLİĞİNİ
 * kontrol eden hiçbir şey yoktu — yani aynı tenant'taki herhangi bir üye
 * başkasının hackathonunun fazını ilerletebilir, config'ini değiştirebilir,
 * kazananı belirleyebilirdi. Burada sahiplik/izin açıkça kontrol ediliyor.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ basketId: string }> }) {
  const identity = await resolveIdentity(req);
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { basketId } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const sb = getDb(req);
  const { data: basket } = await sb
    .from("baskets")
    .select("id, tenant_id, created_by, config, hackathon_ends_at")
    .eq("id", basketId)
    .maybeSingle();

  if (!basket || basket.tenant_id !== identity.tenantId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const isOwner = basket.created_by === identity.email;
  if (!isOwner) {
    const canManage = await userHasPermission(
      identity.tenantId,
      identity.userId,
      "hackathon.manage",
      basketId,
      req
    );
    if (!canManage) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Beyaz liste: istemci hangi kolonu yazabileceğini belirlemesin.
  const patch: Record<string, unknown> = {};
  const allow = [
    "phase",
    "config",
    "selected_idea_id",
    "current_demo_idx",
    "hackathon_ends_at",
    "team_turn_idx",
    "team_turn_ends_at",
    "lobby_locked",
    "status",
    "winner_idea_id",
    "production_note",
    "project_link",
  ] as const;
  for (const key of allow) {
    if (key in body) patch[key] = body[key];
  }
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "no_fields" }, { status: 400 });
  }

  // Lobiden çıkınca katılım kilitlenir (lib/db.ts setBasketPhase'deki kural,
  // artık sunucuda: istemci kilidi atlayarak faz değiştiremesin).
  if (typeof patch.phase === "string" && patch.phase !== "lobby") {
    patch.lobby_locked = true;
  }

  const { data, error } = await sb
    .from("baskets")
    .update(patch)
    .eq("id", basketId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ basket: data });
}

/** DELETE — sepeti sil (yalnızca sahibi; RLS de aynı kuralı zorluyor). */
export async function DELETE(req: Request, ctx: { params: Promise<{ basketId: string }> }) {
  const identity = await resolveIdentity(req);
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { basketId } = await ctx.params;

  const sb = getDb(req);
  const { error } = await sb.from("baskets").delete().eq("id", basketId);
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}
