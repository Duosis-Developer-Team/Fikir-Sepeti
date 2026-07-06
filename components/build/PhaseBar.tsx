"use client";

import type { Phase } from "@/lib/types";

const STEPS: { key: Phase; label: string }[] = [
  { key: "ideas", label: "Fikir" },
  { key: "finalists", label: "Finalist" },
  { key: "demos", label: "Demo" },
  { key: "voting", label: "Oylama" },
  { key: "squad", label: "Squad" },
];

export function PhaseBar({ phase }: { phase: Phase }) {
  const activeIdx = STEPS.findIndex((s) => s.key === phase);
  const idx = phase === "resolved" ? STEPS.length : activeIdx;

  return (
    <div className="flex items-center gap-1.5">
      {STEPS.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={s.key} className="flex flex-1 flex-col items-center gap-1.5">
            <div
              className="h-1 w-full rounded-full transition-colors"
              style={{
                background: done || active ? "var(--accent-build)" : "var(--border)",
                opacity: active ? 1 : done ? 0.55 : 1,
              }}
            />
            <span
              className="text-[11px]"
              style={{ color: active ? "var(--accent-build)" : "var(--text-muted)" }}
            >
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
