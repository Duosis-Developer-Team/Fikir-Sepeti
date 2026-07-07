"use client";

import { supabase } from "./supabase";
import type { Basket, BasketType, Idea, Phase, ResolveMethod } from "./types";

// ---- Sepetler ----

export async function listBaskets(): Promise<Basket[]> {
  const { data } = await supabase
    .from("baskets")
    .select("*")
    .order("created_at", { ascending: false });
  return (data as Basket[]) ?? [];
}

/** Ana ekran için zengin veri: sepetler + her sepetin fikirleri (canlı bar + katılımcı için). */
export async function loadHome(): Promise<{
  baskets: Basket[];
  ideasByBasket: Record<string, Idea[]>;
}> {
  const baskets = await listBaskets();
  const ids = baskets.map((b) => b.id);
  const ideasByBasket: Record<string, Idea[]> = {};
  if (ids.length) {
    const { data } = await supabase
      .from("ideas")
      .select("*")
      .in("basket_id", ids)
      .order("vote_count", { ascending: false });
    for (const idea of (data as Idea[]) ?? []) {
      (ideasByBasket[idea.basket_id] ??= []).push(idea);
    }
  }
  return { baskets, ideasByBasket };
}

export async function createBasket(input: {
  title: string;
  type: BasketType;
  resolve_method: ResolveMethod;
  created_by: string;
}): Promise<Basket | null> {
  const isHackathon = input.type === "hackathon";
  const { data } = await supabase
    .from("baskets")
    .insert({
      title: input.title,
      type: input.type,
      resolve_method: isHackathon ? "vote" : input.resolve_method,
      phase: isHackathon ? "lobby" : "ideas",
      created_by: input.created_by,
    })
    .select()
    .single();
  return (data as Basket) ?? null;
}

export async function deleteBasket(id: string) {
  await supabase.from("baskets").delete().eq("id", id);
}

export async function setBasketPhase(id: string, phase: Phase) {
  await supabase.from("baskets").update({ phase }).eq("id", id);
}

export async function setCurrentDemoIdx(id: string, idx: number) {
  await supabase.from("baskets").update({ current_demo_idx: idx }).eq("id", id);
}

export async function resolveBasket(id: string, winnerIdeaId: string, phase: Phase = "resolved") {
  await supabase
    .from("baskets")
    .update({ status: "resolved", phase, winner_idea_id: winnerIdeaId })
    .eq("id", id);
}

// ---- Fikirler ----

export async function addIdea(input: {
  basket_id: string;
  text: string;
  tag?: string | null;
  created_by: string;
}): Promise<Idea | null> {
  const { data } = await supabase
    .from("ideas")
    .insert({
      basket_id: input.basket_id,
      text: input.text,
      tag: input.tag ?? null,
      created_by: input.created_by,
    })
    .select()
    .single();
  return (data as Idea) ?? null;
}

export async function deleteIdea(ideaId: string) {
  await supabase.from("ideas").delete().eq("id", ideaId);
}

export async function setFinalists(basketId: string, finalistIds: string[]) {
  // Önce hepsini sıfırla, sonra seçilenleri işaretle.
  await supabase.from("ideas").update({ is_finalist: false }).eq("basket_id", basketId);
  if (finalistIds.length) {
    await supabase.from("ideas").update({ is_finalist: true }).in("id", finalistIds);
  }
}

export async function updateDemo(
  ideaId: string,
  fields: { demo_url?: string | null; presenter?: string | null; live_at?: string | null }
) {
  await supabase.from("ideas").update(fields).eq("id", ideaId);
}

// ---- Squad ----

export async function addSquadMember(basketId: string, member: string) {
  // aynı üye iki kez eklenirse unique (23505) döner — sessizce yut.
  const { error } = await supabase
    .from("squad_members")
    .insert({ basket_id: basketId, member });
  if (error && error.code !== "23505") throw error;
}

export async function listSquad(basketId: string): Promise<string[]> {
  const { data } = await supabase
    .from("squad_members")
    .select("member")
    .eq("basket_id", basketId)
    .order("created_at", { ascending: true });
  return (data ?? []).map((r) => r.member as string);
}
