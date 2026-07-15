"use client";

import { computeTeamScores, type RubricCategory } from "@/lib/scoring";
import type { Score, Team } from "@/lib/types";
import { GOLD, GOLD_SOFT, dim } from "./contract";

export function Scoreboard({
  teams,
  scores,
  rubric,
  juryEnabled,
  juryWeight,
}: {
  teams: Team[];
  scores: Score[];
  rubric: RubricCategory[];
  juryEnabled?: boolean;
  juryWeight?: number;
}) {
  const ranked = computeTeamScores({
    teamIds: teams.map((t) => t.id),
    scores,
    rubric,
    juryEnabled,
    juryWeight,
  }).sort((a, b) => b.total - a.total);

  const nameOf = (id: string) => teams.find((t) => t.id === id)?.name ?? id;

  return (
    <div className="mt-8" data-testid="scoreboard">
      <h3
        className="text-[0.72rem] font-bold uppercase tracking-[0.22em]"
        style={{ color: dim(0.5) }}
      >
        Skorboard
      </h3>
      <div className="mt-3 flex flex-col gap-3">
        {ranked.map((row, i) => (
          <div
            key={row.teamId}
            className="rounded-[18px] p-4"
            style={{
              background: "var(--card)",
              border: `1px solid ${i === 0 ? GOLD : "rgba(var(--border-rgb),0.08)"}`,
            }}
            data-testid="scoreboard-row"
            data-team={nameOf(row.teamId)}
            data-total={row.total.toFixed(2)}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-display text-[1.15rem] font-bold" style={{ color: i === 0 ? GOLD : "var(--text)" }}>
                {i + 1}. {nameOf(row.teamId)}
              </span>
              <span className="tnum font-display text-[1.6rem] font-extrabold" style={{ color: GOLD }}>
                {row.total.toFixed(2)}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2" data-testid="scoreboard-breakdown">
              {row.categories.map((c) => (
                <span
                  key={c.key}
                  className="rounded-full px-2.5 py-1 text-[0.75rem]"
                  style={{ background: "rgba(231,169,63,0.1)", color: GOLD_SOFT }}
                  data-category={c.key}
                  data-avg={c.avgStars.toFixed(2)}
                >
                  {c.label}: {c.avgStars.toFixed(1)}★
                </span>
              ))}
            </div>
          </div>
        ))}
        {!ranked.length && (
          <p className="text-[0.9rem]" style={{ color: dim(0.4) }}>Henüz puan yok.</p>
        )}
      </div>
    </div>
  );
}
