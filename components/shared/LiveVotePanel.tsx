"use client";

import { AnimatePresence, motion } from "motion/react";
import type { Idea, Phase } from "@/lib/types";
import { soft, type Accent } from "@/lib/accent";
import { AnimatedNumber } from "./AnimatedNumber";

/** Oylama Detay'a göre canlı oy satırları — aksan renkli. */
export function LiveVotePanel({
  ideas,
  phase,
  myVoteId,
  onVote,
  accent,
}: {
  ideas: Idea[];
  phase: Phase;
  myVoteId?: string;
  onVote?: (ideaId: string, phase: Phase) => void;
  accent: Accent;
}) {
  const sorted = [...ideas].sort((a, b) => b.vote_count - a.vote_count);
  const max = Math.max(1, ...sorted.map((i) => i.vote_count));
  const leaderCount = Math.max(0, ...sorted.map((i) => i.vote_count));

  return (
    <div className="flex flex-col gap-3">
      <AnimatePresence initial={false}>
        {sorted.map((idea, rank) => {
          const pct = (idea.vote_count / max) * 100;
          const mine = myVoteId === idea.id;
          const lead = idea.vote_count === leaderCount && leaderCount > 0;
          return (
            <motion.div
              key={idea.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              className="relative overflow-hidden rounded-[18px]"
              style={{
                background: "#242424",
                border: `1px solid ${lead ? soft(accent, 0.5) : "rgba(255,255,255,0.09)"}`,
              }}
            >
              <div
                className="absolute inset-y-0 left-0"
                style={{ width: `${pct}%`, background: soft(accent, lead ? 0.2 : 0.09), transition: "width 600ms cubic-bezier(.2,.8,.2,1)" }}
              />
              <div className="relative z-[1] flex items-center gap-[18px] px-[22px] py-5">
                <span className="font-display tnum w-5 shrink-0 text-[1.05rem]" style={{ color: "#6E6E6E" }}>{rank + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-[1.2rem] font-semibold leading-[1.15]" style={{ color: "#EDEDED" }}>{idea.text}</div>
                  {(idea.tag || idea.created_by) && (
                    <div className="mt-[3px] text-[0.85rem]" style={{ color: "#9A9A9A" }}>
                      {idea.tag ? `${idea.tag} · ` : ""}{idea.created_by ?? ""}
                    </div>
                  )}
                </div>
                <span className="font-display tnum w-[46px] shrink-0 text-right text-[1.7rem] font-bold" style={{ color: lead ? accent.base : "#EDEDED" }}>
                  <AnimatedNumber value={idea.vote_count} />
                </span>
                {onVote && (
                  <button
                    onClick={() => onVote(idea.id, phase)}
                    title={mine ? "oyunu geri al" : "oy ver"}
                    className="shrink-0 rounded-full px-[18px] py-[10px] text-[0.9rem] font-semibold transition hover:opacity-90"
                    style={mine ? { background: accent.base, color: "#0F0F0F" } : { background: "#EDEDED", color: "#0F0F0F" }}
                  >
                    {mine ? "oyun ✓" : "oy ver"}
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
