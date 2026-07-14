import { NextResponse } from "next/server";
import {
  resolveIdentity,
  supabaseAdmin,
  userHasPermission,
} from "@/lib/server-auth";

async function canViewBasket(
  tenantId: string,
  userId: string,
  email: string,
  basket: { id: string; created_by: string | null; tenant_id: string }
): Promise<boolean> {
  if (basket.tenant_id !== tenantId) return false;
  const viewAll = await userHasPermission(tenantId, userId, "archive.view_all");
  if (viewAll) return true;
  if (basket.created_by === email || basket.created_by === userId) return true;

  const sb = supabaseAdmin();
  const { data: part } = await sb
    .from("hackathon_participants")
    .select("id")
    .eq("basket_id", basket.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (part) return true;

  const { data: vote } = await sb
    .from("votes")
    .select("id")
    .eq("basket_id", basket.id)
    .eq("voter", email)
    .limit(1)
    .maybeSingle();
  return Boolean(vote);
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ basketId: string }> }
) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { basketId } = await ctx.params;
  const sb = supabaseAdmin();
  const { data: basket, error } = await sb
    .from("baskets")
    .select("*")
    .eq("id", basketId)
    .maybeSingle();

  if (error || !basket) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const ok = await canViewBasket(
    identity.tenantId,
    identity.userId,
    identity.email,
    basket as { id: string; created_by: string | null; tenant_id: string }
  );
  if (!ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const [ideas, votes, participants, teams, members, teamVotes, feedback] =
    await Promise.all([
      sb.from("ideas").select("*").eq("basket_id", basketId).order("vote_count", { ascending: false }),
      sb.from("votes").select("id, idea_id, phase, voter, created_at").eq("basket_id", basketId),
      sb.from("hackathon_participants").select("*").eq("basket_id", basketId),
      sb.from("teams").select("*").eq("basket_id", basketId),
      sb.from("team_members").select("*").eq("basket_id", basketId),
      sb.from("team_votes").select("*").eq("basket_id", basketId),
      sb.from("feedback").select("*").eq("basket_id", basketId).order("created_at", { ascending: true }),
    ]);

  const winnerIdeaId = basket.winner_idea_id ?? basket.selected_idea_id;
  const winner = (ideas.data ?? []).find((i) => i.id === winnerIdeaId) ?? null;

  return NextResponse.json({
    basket,
    ideas: ideas.data ?? [],
    votes: votes.data ?? [],
    participants: participants.data ?? [],
    teams: teams.data ?? [],
    members: members.data ?? [],
    teamVotes: teamVotes.data ?? [],
    feedback: feedback.data ?? [],
    winner,
  });
}
