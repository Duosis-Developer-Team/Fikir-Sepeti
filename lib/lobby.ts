import type { Basket, HackathonConfig, Phase } from "./types";

export type JoinDecision =
  | { ok: true; approved: boolean }
  | { ok: false; reason: "locked" | "not_found" };

/** Pure join gate for lobby / late-join rules (S11). */
export function decideLobbyJoin(input: {
  basket: Pick<Basket, "phase" | "lobby_locked" | "status"> & {
    config?: HackathonConfig | null;
  };
  isOwner: boolean;
}): JoinDecision {
  if (input.isOwner) {
    return { ok: true, approved: true };
  }

  const config = input.basket.config ?? {};
  const phase = input.basket.phase as Phase;
  const inLobby = phase === "lobby";
  const allowLate = config.allowLateJoin === true;

  // Started (or explicitly locked) without late-join → blocked
  if (!inLobby && !allowLate) {
    return { ok: false, reason: "locked" };
  }
  if (inLobby && input.basket.lobby_locked === true && !allowLate) {
    return { ok: false, reason: "locked" };
  }

  const approved = config.lobbyPolicy !== "approval";
  return { ok: true, approved };
}

export function ideaStatusLabel(
  config: HackathonConfig | null | undefined
): string {
  const src = config?.ideaSource;
  if (src === "static") return "Fikir belli — admin girecek / girdi.";
  if (src === "pool") return "Fikir birlikte belirlenecek (brainstorm).";
  if (src === "repo") return "Fikir kavanozdan seçilecek.";
  return "Fikir durumu henüz ayarlanmadı.";
}
