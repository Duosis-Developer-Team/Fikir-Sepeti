"use client";

import { apiFetch } from "./api-headers";
import { patchBasket } from "./db";
import type {
  DurationUnit,
  Feedback,
  HackathonConfig,
  Idea,
  Participant,
  Score,
  Team,
  TeamMember,
  TeamVote,
  Basket,
} from "./types";

const UNIT_MS: Record<DurationUnit, number> = { hour: 3600e3, day: 86400e3, week: 604800e3 };

/**
 * Hackathon istemci işlemleri — tamamı kendi API'miz üzerinden.
 * Tarayıcıdan veritabanına doğrudan tek bir çağrı kalmadı.
 */

// ---- Veri paketi ----

export type HackBundle = {
  basket: Basket;
  ideas: Idea[];
  participants: Participant[];
  teams: Team[];
  members: TeamMember[];
  teamVotes: TeamVote[];
  scores: Score[];
};

/**
 * Tüm hackathon verisi tek çağrıda.
 *
 * Eskiden HackathonRunner 7 ayrı sorguyu tarayıcıdan paralel atıyor ve
 * realtime her olayda hepsini tekrar atıyordu — yoğun bir demo fazında
 * saniyede onlarca istek. Artık tek uç; sorgular sunucuda paralel koşuyor.
 */
export async function loadHackData(basketId: string): Promise<HackBundle | null> {
  const res = await apiFetch<HackBundle>(`/api/hackathon/${basketId}`);
  return res.ok ? (res.data as HackBundle) : null;
}

// ---- Faz / süre ----

/** Hackathon fazına geçerken bitiş zamanını (şimdi + süre) yaz. */
export async function startHackathonTimer(basketId: string, config: HackathonConfig) {
  const d = config.duration;
  const ms = d ? d.value * UNIT_MS[d.unit] : UNIT_MS.day;
  await patchBasket(basketId, {
    hackathon_ends_at: new Date(Date.now() + ms).toISOString(),
  });
}

/**
 * Süre uzat — lobideki "Ne kadar sürecek" ile aynı sayı + birim (saat/gün/hafta)
 * sistemi. Dolmadıysa mevcut bitişe eklenir, dolduysa şimdiden başlar.
 * Date.now() burada (component değil, düz fonksiyon) — react-hooks/purity
 * component/hook gövdesindeki impure çağrılara hata veriyor.
 */
export function extendedEndsAt(currentEndsAt: string | null, value: number, unit: DurationUnit): string {
  const currentMs = currentEndsAt ? new Date(currentEndsAt).getTime() : Date.now();
  const base = Math.max(Date.now(), currentMs);
  return new Date(base + value * UNIT_MS[unit]).toISOString();
}

/** Hackathon'u kapat — kazanan fikri işaretle, üretime alındı. */
export async function markDone(
  basketId: string,
  winnerIdeaId: string | null,
  meta?: { production_note?: string | null; project_link?: string | null }
) {
  await patchBasket(basketId, {
    status: "resolved",
    phase: "done",
    winner_idea_id: winnerIdeaId,
    ...(meta?.production_note !== undefined ? { production_note: meta.production_note } : {}),
    ...(meta?.project_link !== undefined ? { project_link: meta.project_link } : {}),
  });
}

// ---- Config ----

export async function setConfig(basketId: string, config: HackathonConfig) {
  await patchBasket(basketId, { config });
}

export async function setSelectedIdea(basketId: string, ideaId: string | null) {
  await patchBasket(basketId, { selected_idea_id: ideaId });
}

/** Kilitlenen fikirler: birincil selected_idea_id + config.lockedIdeaIds. */
export async function lockIdeas(basketId: string, ideaIds: string[], config: HackathonConfig) {
  await patchBasket(basketId, {
    selected_idea_id: ideaIds[0] ?? null,
    config: {
      ...config,
      lockedIdeaIds: ideaIds.length > 1 ? ideaIds : undefined,
    },
  });
}

// ---- Sıralı takım turu ----

export async function setTeamTurn(basketId: string, idx: number, endsAt: string | null) {
  await patchBasket(basketId, { team_turn_idx: idx, team_turn_ends_at: endsAt });
}

// ---- Lobi ----

/** Server-gated join via /api/lobby/join. */
export async function joinLobbyGated(input: {
  basket_id: string;
  email: string;
  tenant_id: string;
  display_name: string | null;
}): Promise<{ ok: boolean; approved?: boolean; error?: string }> {
  const res = await apiFetch<{ approved?: boolean }>("/api/lobby/join", {
    method: "POST",
    email: input.email,
    tenantId: input.tenant_id,
    body: JSON.stringify({
      basket_id: input.basket_id,
      display_name: input.display_name,
    }),
  });
  if (!res.ok) return { ok: false, error: res.error ?? "join_failed" };
  return { ok: true, approved: res.data?.approved };
}

// ---- Takımlar ----

async function teamAction(basketId: string, body: Record<string, unknown>) {
  await apiFetch(`/api/hackathon/${basketId}/teams`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Takımları sıfırdan kur: mevcutları sil, yeni takımlar + üyeleri oluştur. */
export async function rebuildTeams(
  basketId: string,
  _tenantId: string,
  teams: { name: string; members: string[] }[]
) {
  await teamAction(basketId, { action: "rebuild", teams });
}

export async function assignTeamIdeas(
  pairs: { teamId: string; ideaId: string }[],
  basketId: string
) {
  await teamAction(basketId, { action: "assignIdeas", pairs });
}

export async function renameTeam(teamId: string, name: string, basketId: string) {
  await teamAction(basketId, { action: "rename", teamId, name });
}

export async function setTeamAngle(teamId: string, angle: string, basketId: string) {
  await teamAction(basketId, { action: "angle", teamId, angle });
}

/** N takıma böl (random ya da sıralı) — saf yardımcı, sunucuya gitmez. */
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

// ---- Demo oyları ----

/**
 * Demo fazında kişi başı 1 oy — değiştirilebilir.
 * "Kendi takımına oy veremezsin" kuralı artık SUNUCUDA (eskiden sadece
 * butonun disabled olması vardı, istekle atlanabiliyordu).
 */
export async function voteTeam(
  basketId: string,
  teamId: string,
  voter: string,
  tenantId: string
) {
  await apiFetch(`/api/hackathon/${basketId}/team-vote`, {
    method: "POST",
    email: voter,
    tenantId,
    body: JSON.stringify({ team_id: teamId }),
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
  const res = await apiFetch<{ feedback: Feedback[] }>(`/api/hackathon/${basketId}/feedback`);
  return res.data?.feedback ?? [];
}

// ---- Rubric scores (S7) ----

/** is_jury sunucuda hackathon.jury izninden türetiliyor — istemci belirleyemez. */
export async function upsertScore(input: {
  basket_id: string;
  tenant_id: string;
  team_id: string;
  voter: string;
  category_key: string;
  stars: number;
}) {
  const res = await apiFetch("/api/scores", {
    method: "POST",
    email: input.voter,
    tenantId: input.tenant_id,
    body: JSON.stringify({
      basket_id: input.basket_id,
      team_id: input.team_id,
      category_key: input.category_key,
      stars: input.stars,
    }),
  });
  if (!res.ok) throw new Error(res.error ?? "score_failed");
}
