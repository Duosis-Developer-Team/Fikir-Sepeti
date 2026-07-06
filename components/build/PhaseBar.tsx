"use client";

import { soft, type Accent } from "@/lib/accent";
import type { Phase } from "@/lib/types";

const STEPS: { key: Phase; label: string }[] = [
  { key: "ideas", label: "Fikir" },
  { key: "finalists", label: "Finalist" },
  { key: "demos", label: "Demo" },
  { key: "voting", label: "Oylama" },
  { key: "squad", label: "Squad" },
];

export function PhaseBar({ phase, accent }: { phase: Phase; accent: Accent }) {
  const activeIdx = STEPS.findIndex((s) => s.key === phase);
  const idx = phase === "resolved" ? STEPS.length : activeIdx;
  return (
    <div className="flex gap-[10px]">
      {STEPS.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={s.key} className="flex flex-1 flex-col items-center gap-[9px]">
            <span
              className="h-1 w-full rounded-full"
              style={{
                background: done || active ? accent.base : "rgba(255,255,255,0.12)",
                opacity: done ? 0.55 : 1,
                boxShadow: active ? `0 0 16px ${soft(accent, 0.5)}` : "none",
              }}
            />
            <span className="text-[0.85rem]" style={{ color: active ? accent.base : "#6E6E6E", fontWeight: active ? 600 : 400 }}>
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
