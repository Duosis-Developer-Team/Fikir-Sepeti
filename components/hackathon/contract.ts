import type React from "react";
import type { Basket, HackathonConfig, Idea, Participant, Score, Team, TeamMember, TeamVote } from "@/lib/types";
import type { SessionUser } from "@/components/AuthGate";

/** Hackathon faz makinesi — sabit iskelet. */
export type StagePhase = "lobby" | "idea" | "team" | "hackathon" | "demo" | "feedback" | "production" | "done";

export const PHASE_ORDER: StagePhase[] = ["lobby", "idea", "team", "hackathon", "demo", "feedback", "production", "done"];

export const PHASE_LABEL: Record<StagePhase, string> = {
  lobby: "Lobi",
  idea: "Fikir",
  team: "Takım",
  hackathon: "Hackathon",
  demo: "Sunum & Puanlama",
  feedback: "Feedback",
  production: "Sonuçlar",
  done: "Tamamlandı",
};

/** Tüm modüllerin paylaştığı veri — orchestrator toplar, realtime tazeler. */
export type HackData = {
  basket: Basket;
  ideas: Idea[];
  participants: Participant[];
  teams: Team[];
  members: TeamMember[];
  teamVotes: TeamVote[];
  scores: Score[];
};

/** Modül sözleşmesi: her aşama bu context'i alır; orchestrator içini bilmez. */
export type StageContext = {
  data: HackData;
  config: HackathonConfig;
  user: SessionUser;
  isAdmin: boolean;
  refresh: () => Promise<void>;
  /** S11 (FS-10): lobide, davetsiz/sahipsiz bir ziyaretçi henüz katılmadıysa true. */
  needsJoinAction?: boolean;
  onJoin?: () => void;
  /** Admin üst stepper'dan geçmiş bir aşamayı önizliyor — mutasyon yok, sadece görüntüleme. */
  readOnly?: boolean;
};

export type StageDef = {
  key: StagePhase;
  Comp: React.FC<StageContext>;
  /** Admin bir sonraki faza geçebilir mi? */
  canAdvance: (ctx: StageContext) => boolean;
};

// paylaşılan renk tokenları (hackathon = altın)
export const GOLD = "#E7A93F";
export const GOLD_SOFT = "#EEC078";
export const dim = (a: number) => `rgba(var(--text-rgb), ${a})`;

/** config tamam mı — lobide "başlat" için. */
export function configReady(c: HackathonConfig): boolean {
  if (!c.ideaSource) return false;
  if ((c.ideaSource === "pool" || c.ideaSource === "repo") && !c.poolSelect) return false;
  if (!c.teamMode) return false;
  if (c.teamMode === "groups" && !c.groups) return false;
  return true;
}
