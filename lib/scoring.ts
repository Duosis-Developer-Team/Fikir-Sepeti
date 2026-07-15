/** Rubric category library + weighted score math (S7). */

export type RubricCategory = {
  key: string;
  label: string;
  weight: number;
  /** Built-in library key vs custom */
  custom?: boolean;
};

export const SCORE_LIBRARY: RubricCategory[] = [
  { key: "coding", label: "Kod kalitesi", weight: 1 },
  { key: "ui", label: "Arayüz", weight: 1 },
  { key: "tech", label: "Teknoloji", weight: 1 },
  { key: "usability", label: "Kullanılabilirlik", weight: 1 },
  { key: "impact", label: "Etki / değer", weight: 1 },
  { key: "innovation", label: "Yenilikçilik", weight: 1 },
  { key: "completeness", label: "Tamamlanmışlık", weight: 1 },
  { key: "presentation", label: "Sunum", weight: 1 },
  { key: "subjective", label: "Öznel", weight: 1 },
];

/** Default ~5 + subjective — "3 tıkta kabul" seti. */
export const DEFAULT_RUBRIC: RubricCategory[] = [
  SCORE_LIBRARY.find((c) => c.key === "coding")!,
  SCORE_LIBRARY.find((c) => c.key === "ui")!,
  SCORE_LIBRARY.find((c) => c.key === "impact")!,
  SCORE_LIBRARY.find((c) => c.key === "innovation")!,
  SCORE_LIBRARY.find((c) => c.key === "presentation")!,
  SCORE_LIBRARY.find((c) => c.key === "subjective")!,
];

export type ScoreRow = {
  team_id: string;
  voter: string;
  category_key: string;
  stars: number;
  is_jury: boolean;
};

export type CategoryBreakdown = {
  key: string;
  label: string;
  weight: number;
  avgStars: number;
  weighted: number;
};

export type TeamScore = {
  teamId: string;
  total: number;
  categories: CategoryBreakdown[];
};

/**
 * Weighted average stars per category (juryWeight multiplies jury votes),
 * then category weight applied to produce team total.
 */
export function computeTeamScores(args: {
  teamIds: string[];
  scores: ScoreRow[];
  rubric: RubricCategory[];
  juryEnabled?: boolean;
  juryWeight?: number;
}): TeamScore[] {
  const {
    teamIds,
    scores,
    rubric,
    juryEnabled = false,
    juryWeight = 2,
  } = args;
  const weightSum = rubric.reduce((s, r) => s + r.weight, 0) || 1;

  return teamIds.map((teamId) => {
    const categories: CategoryBreakdown[] = rubric.map((cat) => {
      const rows = scores.filter(
        (s) => s.team_id === teamId && s.category_key === cat.key
      );
      let weightedStars = 0;
      let weightAcc = 0;
      for (const r of rows) {
        const w = juryEnabled && r.is_jury ? juryWeight : 1;
        weightedStars += r.stars * w;
        weightAcc += w;
      }
      const avgStars = weightAcc > 0 ? weightedStars / weightAcc : 0;
      const weighted = (avgStars * cat.weight) / weightSum;
      return {
        key: cat.key,
        label: cat.label,
        weight: cat.weight,
        avgStars,
        weighted,
      };
    });
    const total = categories.reduce((s, c) => s + c.weighted, 0);
    return { teamId, total, categories };
  });
}

/** Max custom categories allowed beyond library (plan: ≤2). */
export const MAX_CUSTOM_CATEGORIES = 2;
