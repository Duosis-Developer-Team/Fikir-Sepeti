"use client";

import { supabase } from "./supabase";
import type { Feedback, HackathonConfig, Participant, Team, TeamMember, TeamVote } from "./types";

// ---- Lobi / katılımcılar ----

export async function joinLobby(input: {
  basket_id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  role?: "admin" | "member";
}) {
  await supabase.from("hackathon_participants").upsert(
    {
      basket_id: input.basket_id,
      user_id: input.user_id,
      email: input.email,
      display_name: input.display_name,
      role: input.role ?? "member",
    },
    { onConflict: "basket_id,user_id" }
  );
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
export async function markDone(basketId: string, winnerIdeaId: string | null) {
  await supabase
    .from("baskets")
    .update({ status: "resolved", phase: "done", winner_idea_id: winnerIdeaId })
    .eq("id", basketId);
}

// ---- Config ----

export async function setConfig(basketId: string, config: HackathonConfig) {
  await supabase.from("baskets").update({ config }).eq("id", basketId);
}

export async function setSelectedIdea(basketId: string, ideaId: string | null) {
  await supabase.from("baskets").update({ selected_idea_id: ideaId }).eq("id", basketId);
}

// ---- Takımlar ----

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
  teams: { name: string; members: string[] }[]
) {
  await supabase.from("teams").delete().eq("basket_id", basketId);
  for (const t of teams) {
    const { data } = await supabase
      .from("teams")
      .insert({ basket_id: basketId, name: t.name })
      .select()
      .single();
    const team = data as Team | null;
    if (team && t.members.length) {
      await supabase.from("team_members").insert(
        t.members.map((uid) => ({ team_id: team.id, basket_id: basketId, user_id: uid }))
      );
    }
  }
}

/** N takıma böl (random ya da sıralı). */
export function partition(userIds: string[], count: number, shuffle: boolean): string[][] {
  const ids = [...userIds];
  if (shuffle) {
    // deterministik olmayan gerek yok; basit Fisher-Yates
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
export async function voteTeam(basketId: string, teamId: string, voter: string) {
  await supabase.from("team_votes").delete().eq("basket_id", basketId).eq("voter", voter);
  await supabase.from("team_votes").insert({ team_id: teamId, basket_id: basketId, voter });
}

// ---- Feedback ----

export async function addFeedback(input: {
  basket_id: string;
  team_id?: string | null;
  idea_id?: string | null;
  author_id: string | null;
  author_name: string | null;
  text: string;
}) {
  await supabase.from("feedback").insert({
    basket_id: input.basket_id,
    team_id: input.team_id ?? null,
    idea_id: input.idea_id ?? null,
    author_id: input.author_id,
    author_name: input.author_name,
    text: input.text,
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
