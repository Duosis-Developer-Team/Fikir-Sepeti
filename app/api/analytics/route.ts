import { NextResponse } from "next/server";
import {
  buildFunnel,
  computeRetention3Month,
  teaserParticipationPct,
  type FunnelStageKey,
  type ParticipationEvent,
} from "@/lib/analytics";
import {
  resolveIdentity,
  getDb,
  userHasPermission,
} from "@/lib/server-auth";

type BasketRow = {
  id: string;
  title: string;
  type: string;
  phase: string;
  status: string;
  created_by: string | null;
  created_at: string;
  production_note: string | null;
  effort_estimate: number | null;
  winner_idea_id: string | null;
  selected_idea_id: string | null;
};

/**
 * GET /api/analytics
 * Always returns teaser summary.
 * ?full=1 requires analytics.view — otherwise 403.
 */
export async function GET(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const wantFull = url.searchParams.get("full") === "1";

  const canView = await userHasPermission(
    identity.tenantId,
    identity.userId,
    "analytics.view",
    req);

  if (wantFull && !canView) {
    return NextResponse.json(
      { error: "analytics.view required" },
      { status: 403 }
    );
  }

  const sb = getDb(req);
  const tenantId = identity.tenantId;

  const [
    { count: ideasCount },
    { data: ideaIdsWithVotes },
    { data: selectedRows },
    { data: baskets },
    { data: poolRows },
    { data: votes },
    { data: participants },
    { count: memberCount },
  ] = await Promise.all([
    sb
      .from("ideas")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    sb.from("votes").select("idea_id").eq("tenant_id", tenantId),
    sb
      .from("baskets")
      .select("selected_idea_id, winner_idea_id")
      .eq("tenant_id", tenantId),
    sb
      .from("baskets")
      .select(
        "id, title, type, phase, status, created_by, created_at, production_note, effort_estimate, winner_idea_id, selected_idea_id"
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }),
    sb
      .from("idea_pool")
      .select("id, status, vote_count")
      .eq("tenant_id", tenantId),
    sb.from("votes").select("voter, created_at, basket_id").eq("tenant_id", tenantId),
    sb
      .from("hackathon_participants")
      .select("user_id, email, joined_at, basket_id")
      .eq("tenant_id", tenantId),
    sb
      .from("app_users")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
  ]);

  const tenantCapacity = Math.max(memberCount ?? 1, 1);

  const votedIdeaIds = new Set<string>();
  for (const v of ideaIdsWithVotes ?? []) {
    if (v.idea_id) votedIdeaIds.add(v.idea_id as string);
  }
  for (const b of selectedRows ?? []) {
    if (b.selected_idea_id) votedIdeaIds.add(b.selected_idea_id as string);
    if (b.winner_idea_id) votedIdeaIds.add(b.winner_idea_id as string);
  }
  const poolVoted = (poolRows ?? []).filter(
    (p) =>
      (p.vote_count as number) > 0 ||
      ["voting", "promoted", "archived"].includes(p.status as string)
  ).length;

  const basketList = (baskets ?? []) as BasketRow[];
  const organized = basketList.length;
  const doneBaskets = basketList.filter(
    (b) =>
      b.status === "resolved" ||
      ["done", "resolved", "production", "feedback"].includes(b.phase)
  );
  const productionBaskets = basketList.filter(
    (b) =>
      b.status === "resolved" &&
      (b.phase === "done" ||
        b.phase === "resolved" ||
        b.production_note != null)
  );

  const poolIdeaCount = (poolRows ?? []).length;
  const counts: Record<FunnelStageKey, number> = {
    ideas: (ideasCount ?? 0) + poolIdeaCount,
    voted: votedIdeaIds.size + poolVoted,
    organized,
    done: doneBaskets.length,
    production: productionBaskets.length,
  };

  // Teaser: last 3 resolved etkinlik — voter distinct / max(voters,1)
  const lastEtkinlik = basketList
    .filter((b) => b.type === "etkinlik" && b.status === "resolved")
    .slice(0, 3);
  const voteByBasket = new Map<string, Set<string>>();
  for (const v of votes ?? []) {
    const bid = v.basket_id as string;
    let set = voteByBasket.get(bid);
    if (!set) {
      set = new Set();
      voteByBasket.set(bid, set);
    }
    if (v.voter) set.add(v.voter as string);
  }
  const teaserPct = teaserParticipationPct(
    lastEtkinlik.map((b) => ({
      basketId: b.id,
      participantCount: voteByBasket.get(b.id)?.size ?? 0,
      capacityHint: tenantCapacity,
    }))
  );

  const teaser = {
    lastEventsCount: lastEtkinlik.length,
    participationPct: teaserPct,
    headline:
      teaserPct == null
        ? "Henüz yeterli etkinlik yok"
        : `Son ${lastEtkinlik.length} etkinlikte katılım %${teaserPct}`,
    productionCount: productionBaskets.length,
  };

  if (!wantFull) {
    return NextResponse.json({
      teaser,
      canViewFull: canView,
    });
  }

  const events: ParticipationEvent[] = [];
  for (const v of votes ?? []) {
    if (!v.voter || !v.created_at) continue;
    events.push({
      userKey: v.voter as string,
      at: new Date(v.created_at as string),
    });
  }
  for (const p of participants ?? []) {
    const key = (p.email as string) || (p.user_id as string);
    if (!key || !p.joined_at) continue;
    events.push({ userKey: key, at: new Date(p.joined_at as string) });
  }

  const retention = computeRetention3Month(events, new Date());
  const effortTotal = productionBaskets.reduce(
    (sum, b) => sum + (Number(b.effort_estimate) || 0),
    0
  );

  const production = productionBaskets.map((b) => ({
    id: b.id,
    title: b.title,
    type: b.type,
    created_by: b.created_by,
    created_at: b.created_at,
    production_note: b.production_note,
    effort_estimate: b.effort_estimate,
  }));

  return NextResponse.json({
    teaser,
    canViewFull: true,
    funnel: buildFunnel(counts),
    retention,
    production,
    effortTotal,
  });
}
