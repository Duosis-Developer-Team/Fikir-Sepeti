"use client";

import { supabase } from "./supabase";
import type { DurationUnit, Feedback, HackathonConfig, Participant, Score, Team, TeamMember, TeamVote } from "./types";

const UNIT_MS: Record<DurationUnit, number> = { hour: 3600e3, day: 86400e3, week: 604800e3 };

/** Hackathon fazına geçerken bitiş zamanını (şimdi + süre) yaz. */
export async function startHackathonTimer(basketId: string, config: HackathonConfig) {
  const d = config.duration;
  const ms = d ? d.value * UNIT_MS[d.unit] : UNIT_MS.day;
  const endsAt = new Date(Date.now() + ms).toISOString();
  await supabase.from("baskets").update({ hackathon_ends_at: endsAt }).eq("id", basketId);
}

// ---- Lobi / katılımcılar ----

export async function joinLobby(input: {
  basket_id: string;
  tenant_id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  role?: "admin" | "member";
  approved?: boolean;
}) {
  await supabase.from("hackathon_participants").upsert(
    {
      basket_id: input.basket_id,
      tenant_id: input.tenant_id,
      user_id: input.user_id,
      email: input.email,
      display_name: input.display_name,
      role: input.role ?? "member",
      approved: input.approved ?? true,
    },
    { onConflict: "basket_id,user_id" }
  );
}

/** Server-gated join via /api/lobby/join. */
export async function joinLobbyGated(input: {
  basket_id: string;
  email: string;
  tenant_id: string;
  display_name: string | null;
}): Promise<{ ok: boolean; approved?: boolean; error?: string }> {
  const { apiAuthHeaders } = await import("./api-headers");
  const res = await fetch("/api/lobby/join", {
    method: "POST",
    headers: await apiAuthHeaders(input.email, input.tenant_id),
    body: JSON.stringify({
      basket_id: input.basket_id,
      display_name: input.display_name,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: (json as { error?: string }).error ?? "join_failed" };
  }
  return {
    ok: true,
    approved: (json as { approved?: boolean }).approved,
  };
}

export async function listParticipants(basketId: string): Promise<Participant[]> {
  const { data } = await supabase
    .from("hackathon_participants")
    .select("*")
    .eq("basket_id", basketId)
    .order("joined_at", { ascending: true });
  return (data as Participant[]) ?? [];
}

/** Hackathon'u kapat — kazanan fikri işaretle, üretime alındı. */
export async function markDone(
  basketId: string,
  winnerIdeaId: string | null,
  meta?: { production_note?: string | null; effort_estimate?: number | null }
) {
  await supabase
    .from("baskets")
    .update({
      status: "resolved",
      phase: "done",
      winner_idea_id: winnerIdeaId,
      ...(meta?.production_note !== undefined
        ? { production_note: meta.production_note }
        : {}),
      ...(meta?.effort_estimate !== undefined
        ? { effort_estimate: meta.effort_estimate }
        : {}),
    })
    .eq("id", basketId);
}

// ---- Config ----

export async function setConfig(basketId: string, config: HackathonConfig) {
  await supabase.from("baskets").update({ config }).eq("id", basketId);
}

export async function setSelectedIdea(basketId: string, ideaId: string | null) {
  await supabase.from("baskets").update({ selected_idea_id: ideaId }).eq("id", basketId);
}

/** Persist locked ideas: primary selected_idea_id + optional config.lockedIdeaIds. */
export async function lockIdeas(
  basketId: string,
  ideaIds: string[],
  config: HackathonConfig
) {
  const primary = ideaIds[0] ?? null;
  const next: HackathonConfig = {
    ...config,
    lockedIdeaIds: ideaIds.length > 1 ? ideaIds : undefined,
  };
  await supabase
    .from("baskets")
    .update({ selected_idea_id: primary, config: next })
    .eq("id", basketId);
}

export async function assignTeamIdeas(
  pairs: { teamId: string; ideaId: string }[]
) {
  for (const p of pairs) {
    await supabase.from("teams").update({ idea_id: p.ideaId }).eq("id", p.teamId);
  }
}

export async function setTeamAngle(teamId: string, angle: string) {
  await supabase.from("teams").update({ angle: angle.trim() || null }).eq("id", teamId);
}

// ---- Takımlar ----

export async function renameTeam(teamId: string, name: string) {
  await supabase.from("teams").update({ name: name.trim() || "Takım" }).eq("id", teamId);
}

export async function listTeams(basketId: string): Promise<Team[]> {
  const { data } = await supabase
    .from("teams")
    .select("*")
    .eq("basket_id", basketId)
    .order("created_at", { ascending: true });
  return (data as Team[]) ?? [];
}

export async function listTeamMembers(basketId: string): Promise<TeamMember[]> {
  const { data } = await supabase.from("team_members").select("*").eq("basket_id", basketId);
  return (data as TeamMember[]) ?? [];
}

/** Takımları sıfırdan kur: mevcut takımları sil, yeni takımlar + üyeleri oluştur. */
export async function rebuildTeams(
  basketId: string,
  tenantId: string,
  teams: { name: string; members: string[] }[]
) {
  await supabase.from("teams").delete().eq("basket_id", basketId);
  for (const t of teams) {
    const { data } = await supabase
      .from("teams")
      .insert({ basket_id: basketId, tenant_id: tenantId, name: t.name })
      .select()
      .single();
    const team = data as Team | null;
    if (team && t.members.length) {
      await supabase.from("team_members").insert(
        t.members.map((uid) => ({
          team_id: team.id,
          basket_id: basketId,
          tenant_id: tenantId,
          user_id: uid,
        }))
      );
    }
  }
}

/** N takıma böl (random ya da sıralı). */
export function partition(userIds: string[], count: number, shuffle: boolean): string[][] {
  const ids = [...userIds];
  if (shuffle) {
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
  }
  const buckets: string[][] = Array.from({ length: Math.max(1, count) }, () => []);
  ids.forEach((id, i) => buckets[i % buckets.length].push(id));
  return buckets;
}

// ---- Demo oyları (takıma) ----

export async function listTeamVotes(basketId: string): Promise<TeamVote[]> {
  const { data } = await supabase.from("team_votes").select("*").eq("basket_id", basketId);
  return (data as TeamVote[]) ?? [];
}

/** Demo fazında kişi başı 1 oy — değiştirilebilir (eski oyu sil, yeni ekle). */
export async function voteTeam(
  basketId: string,
  teamId: string,
  voter: string,
  tenantId: string
) {
  await supabase.from("team_votes").delete().eq("basket_id", basketId).eq("voter", voter);
  await supabase.from("team_votes").insert({
    team_id: teamId,
    basket_id: basketId,
    voter,
    tenant_id: tenantId,
  });
}

// ---- Feedback ----

export async function addFeedback(input: {
  basket_id: string;
  tenant_id: string;
  team_id?: string | null;
  idea_id?: string | null;
  author_id: string | null;
  author_name: string | null;
  text: string;
}) {
  const { addFeedbackModerated } = await import("./client-moderation");
  await addFeedbackModerated({
    email: input.author_id || "anonymous",
    tenantId: input.tenant_id,
    basket_id: input.basket_id,
    text: input.text,
    team_id: input.team_id,
    idea_id: input.idea_id,
    author_name: input.author_name,
  });
}

export async function listFeedback(basketId: string): Promise<Feedback[]> {
  const { data } = await supabase
    .from("feedback")
    .select("*")
    .eq("basket_id", basketId)
    .order("created_at", { ascending: false });
  return (data as Feedback[]) ?? [];
}

// ---- Rubric scores (S7) ----

export async function listScores(basketId: string): Promise<Score[]> {
  const { data } = await supabase.from("scores").select("*").eq("basket_id", basketId);
  return (data as Score[]) ?? [];
}

/** Upsert via /api/scores so is_jury is derived server-side from hackathon.jury. */
export async function upsertScore(input: {
  basket_id: string;
  tenant_id: string;
  team_id: string;
  voter: string;
  category_key: string;
  stars: number;
}) {
  const { apiAuthHeaders } = await import("./api-headers");
  const res = await fetch("/api/scores", {
    method: "POST",
    headers: await apiAuthHeaders(input.voter, input.tenant_id),
    body: JSON.stringify({
      basket_id: input.basket_id,
      team_id: input.team_id,
      category_key: input.category_key,
      stars: input.stars,
    }),
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? "score_failed");
  }
}
