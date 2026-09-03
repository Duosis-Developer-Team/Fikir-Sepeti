/** Sıralı takım turu — DemoStage (rubrik) ve FeedbackStage'in paylaştığı saf mantık. */

import type { Feedback, Participant, Score, Team, TeamMember } from "./types";
import type { RubricCategory } from "./scoring";

/** Takımları kararlı bir sırayla dizer (created_at) — turun "sırası" bu diziye göredir. */
export function teamOrder(teams: Team[]): Team[] {
  return [...teams].sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
}

/** idx'teki takım — dizi boşsa/aralık dışıysa null. */
export function teamAtTurn(teams: Team[], idx: number): Team | null {
  const ordered = teamOrder(teams);
  if (!ordered.length) return null;
  return ordered[Math.min(Math.max(0, idx), ordered.length - 1)] ?? null;
}

/** Değerlendirmesi gereken kişiler: onaylı katılımcılar eksi o takımın kendi üyeleri. */
export function requiredReviewers(
  participants: Participant[],
  members: TeamMember[],
  teamId: string
): string[] {
  const own = new Set(members.filter((m) => m.team_id === teamId).map((m) => m.user_id));
  return participants
    .filter((p) => p.approved !== false && !own.has(p.user_id) && !own.has(p.email ?? ""))
    .map((p) => p.user_id);
}

/** Bu kişi bu takımı rubrikteki tüm kategorilerde puanlamış mı? */
function scoredAllCategories(scores: Score[], teamId: string, voter: string, rubric: RubricCategory[]): boolean {
  return rubric.every((cat) =>
    scores.some((s) => s.team_id === teamId && s.category_key === cat.key && s.voter === voter)
  );
}

/** Puanlama turu: gerekli herkes bu takımı tüm kategorilerde puanladı mı + kaçı bitirdi. */
export function scoringTurnProgress(args: {
  team: Team;
  reviewers: string[];
  scores: Score[];
  rubric: RubricCategory[];
}) {
  const { team, reviewers, scores, rubric } = args;
  const done = reviewers.filter((r) => scoredAllCategories(scores, team.id, r, rubric));
  return { done: done.length, total: reviewers.length, complete: reviewers.length > 0 && done.length === reviewers.length };
}

/** Feedback turu: gerekli herkes bu takıma en az bir yorum bıraktı mı + kaçı bıraktı. */
export function feedbackTurnProgress(args: { team: Team; reviewers: string[]; feedback: Feedback[] }) {
  const { team, reviewers, feedback } = args;
  const done = reviewers.filter((r) => feedback.some((f) => f.team_id === team.id && f.author_id === r));
  return { done: done.length, total: reviewers.length, complete: reviewers.length > 0 && done.length === reviewers.length };
}

/** idx + config'ten yeni bir tur bitiş zamanı üretir — dakika ayarlanmadıysa null (süresiz). */
export function nextTurnEndsAt(teamTurnMinutes: number | undefined): string | null {
  if (!teamTurnMinutes || teamTurnMinutes <= 0) return null;
  return new Date(Date.now() + teamTurnMinutes * 60_000).toISOString();
}
