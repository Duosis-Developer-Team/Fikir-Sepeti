"use client";

import { apiFetch } from "./api-headers";
import type { Basket, BasketType, Idea, Phase, ResolveMethod } from "./types";

/**
 * Sepet/fikir işlemleri — hepsi kendi API'miz üzerinden.
 *
 * Eskiden bu dosyadaki çoğu fonksiyon `supabase.from(...)` ile TARAYICIDAN
 * doğrudan veritabanına yazıyordu. Artık tek bir DB çağrısı yok: tarayıcı
 * yalnızca /api/* konuşuyor, yetki kontrolü ve RLS sunucuda.
 *
 * İmzalar korundu — çağıran ~20 bileşen değişmedi.
 */

// ---- Sepetler ----

export async function listBaskets(tenantId: string): Promise<Basket[]> {
  const res = await apiFetch<{ baskets: Basket[] }>("/api/home", { tenantId });
  return res.data?.baskets ?? [];
}

/** Ana ekran için zengin veri: sepetler + her sepetin fikirleri. */
export async function loadHome(tenantId: string): Promise<{
  baskets: Basket[];
  ideasByBasket: Record<string, Idea[]>;
}> {
  const res = await apiFetch<{
    baskets: Basket[];
    ideasByBasket: Record<string, Idea[]>;
  }>("/api/home", { tenantId });
  return {
    baskets: res.data?.baskets ?? [],
    ideasByBasket: res.data?.ideasByBasket ?? {},
  };
}

export async function createBasket(input: {
  title: string;
  type: BasketType;
  resolve_method: ResolveMethod;
  created_by: string;
  tenant_id: string;
}): Promise<Basket | null> {
  const res = await apiFetch<{ basket: Basket }>("/api/baskets", {
    method: "POST",
    email: input.created_by,
    tenantId: input.tenant_id,
    body: JSON.stringify({
      title: input.title,
      type: input.type,
      resolve_method: input.resolve_method,
    }),
  });
  if (!res.ok) {
    console.error("createBasket failed", res.status, res.error);
    return null;
  }
  return res.data?.basket ?? null;
}

export async function deleteBasket(id: string, ctx?: { email?: string; tenantId?: string | null }) {
  await apiFetch(`/api/hackathon/${id}`, {
    method: "DELETE",
    email: ctx?.email,
    tenantId: ctx?.tenantId,
  });
}

export async function updateBasketTitle(input: {
  basket_id: string;
  title: string;
  actor: string;
  tenant_id: string;
}): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch("/api/baskets", {
    method: "PATCH",
    email: input.actor,
    tenantId: input.tenant_id,
    body: JSON.stringify({ basket_id: input.basket_id, title: input.title }),
  });
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

/** Sepet üzerindeki alanları güncelle (faz, config, kazanan, tur…). */
export async function patchBasket(
  id: string,
  patch: Record<string, unknown>,
  ctx?: { email?: string; tenantId?: string | null }
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiFetch(`/api/hackathon/${id}`, {
    method: "PATCH",
    email: ctx?.email,
    tenantId: ctx?.tenantId,
    body: JSON.stringify(patch),
  });
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

export async function setBasketPhase(id: string, phase: Phase) {
  // lobby_locked kuralı artık SUNUCUDA uygulanıyor (bkz.
  // app/api/hackathon/[basketId]/route.ts) — istemci onu atlayamasın.
  await patchBasket(id, { phase });
}

export async function setCurrentDemoIdx(id: string, idx: number) {
  await patchBasket(id, { current_demo_idx: idx });
}

export async function resolveBasket(id: string, winnerIdeaId: string, phase: Phase = "resolved") {
  await patchBasket(id, { status: "resolved", phase, winner_idea_id: winnerIdeaId });
}

// ---- Fikirler ----

export async function addIdea(input: {
  basket_id: string;
  text: string;
  description?: string | null;
  tag?: string | null;
  created_by: string;
  tenant_id: string;
}): Promise<Idea | null> {
  const { addIdeaModerated } = await import("./client-moderation");
  const idea = await addIdeaModerated({
    email: input.created_by,
    tenantId: input.tenant_id,
    basket_id: input.basket_id,
    text: input.text,
    description: input.description,
    tag: input.tag,
  });
  return (idea as Idea) ?? null;
}

export async function deleteIdea(ideaId: string) {
  await apiFetch(`/api/ideas?idea_id=${encodeURIComponent(ideaId)}`, { method: "DELETE" });
}

export async function setFinalists(basketId: string, finalistIds: string[]) {
  await apiFetch("/api/ideas", {
    method: "PATCH",
    body: JSON.stringify({ basket_id: basketId, action: "finalists", finalist_ids: finalistIds }),
  });
}

export async function updateDemo(
  ideaId: string,
  fields: { demo_url?: string | null; presenter?: string | null; live_at?: string | null },
  basketId?: string
) {
  await apiFetch("/api/ideas", {
    method: "PATCH",
    body: JSON.stringify({ basket_id: basketId, action: "demo", idea_id: ideaId, ...fields }),
  });
}

// ---- Squad ----

export async function addSquadMember(basketId: string, member: string, tenantId: string) {
  await apiFetch("/api/squad", {
    method: "POST",
    tenantId,
    body: JSON.stringify({ basket_id: basketId, member }),
  });
}

export async function listSquad(basketId: string): Promise<string[]> {
  const res = await apiFetch<{ members: string[] }>(
    `/api/squad?basket_id=${encodeURIComponent(basketId)}`
  );
  return res.data?.members ?? [];
}
