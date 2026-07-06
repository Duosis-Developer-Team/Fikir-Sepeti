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

export async function createBasket(input: {
  title: string;
  type: BasketType;
  resolve_method: ResolveMethod;
  created_by: string;
}): Promise<Basket | null> {
  const { data } = await supabase
    .from("baskets")
    .insert({
      title: input.title,
      type: input.type,
      resolve_method: input.type === "social" ? input.resolve_method : "vote",
      created_by: input.created_by,
    })
    .select()
    .single();
  return (data as Basket) ?? null;
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
