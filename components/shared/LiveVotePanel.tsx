"use client";

import { AnimatePresence, motion } from "motion/react";
import type { Idea, Phase } from "@/lib/types";

type Accent = "social" | "build";

/**
 * ★ Realtime oylama primitifinin TEK görsel component'i.
 * Sosyal oy, build finalist seçimi ve presenter oyu — üçü de bunu render eder.
 * Fark sadece boyut/stil: presenter'da dev, oy butonsuz; diğerlerinde interaktif.
 */
export function LiveVotePanel({
  ideas,
  phase,
  myVoteId,
  onVote,
  accent = "social",
  size = "normal",
  leaderOnly = false,
}: {
  ideas: Idea[];
  phase: Phase;
  myVoteId?: string;
  onVote?: (ideaId: string, phase: Phase) => void;
  accent?: Accent;
  size?: "normal" | "presenter";
  leaderOnly?: boolean; // presenter: sadece lider bar renkli
}) {
  const accentVar = accent === "build" ? "var(--accent-build)" : "var(--accent-social)";
  const softVar = accent === "build" ? "var(--accent-build-soft)" : "var(--accent-social-soft)";
  const max = Math.max(1, ...ideas.map((i) => i.vote_count));
  const leaderCount = Math.max(0, ...ideas.map((i) => i.vote_count));
  const isPresenter = size === "presenter";
  const voted = Boolean(myVoteId);

  return (
    <div className={isPresenter ? "space-y-4" : "space-y-2.5"}>
      <AnimatePresence initial={false}>
        {ideas.map((idea) => {
          const pct = (idea.vote_count / max) * 100;
          const mine = myVoteId === idea.id;
          const isLeader = idea.vote_count === leaderCount && leaderCount > 0;
          const colored = leaderOnly ? isLeader : true;
          return (
            <motion.div
              key={idea.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className={`relative overflow-hidden rounded-[var(--radius)] border ${
                isPresenter ? "border-white/10 bg-white/5" : "border-[var(--border)] bg-[var(--surface)]"
              }`}
            >
              {/* dolum barı */}
              <motion.div
                className="absolute inset-y-0 left-0"
                style={{ background: colored ? softVar : "rgba(120,120,120,0.12)" }}
                initial={false}
                animate={{ width: `${pct}%` }}
                transition={{ type: "spring", stiffness: 260, damping: 30 }}
              />
              <div
                className={`relative flex items-center justify-between gap-3 ${
                  isPresenter ? "px-6 py-5" : "px-3.5 py-3"
                }`}
              >
                <div className="min-w-0">
                  <p
                    className={`truncate font-medium ${
                      isPresenter ? "text-2xl" : "text-sm"
                    } ${isPresenter ? "text-white" : "text-[var(--text)]"}`}
                  >
                    {idea.text}
                  </p>
                  {idea.presenter && (
                    <p className={`truncate text-[var(--text-muted)] ${isPresenter ? "text-base" : "text-xs"}`}>
                      {idea.presenter}
                      {idea.live_at ? ` · ${idea.live_at}` : ""}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <span
                    className={`tabular-nums font-medium ${isPresenter ? "text-3xl" : "text-sm"}`}
                    style={{ color: colored ? accentVar : undefined }}
                  >
                    {idea.vote_count}
                  </span>
                  {!isPresenter && onVote && (
                    <button
                      onClick={() => onVote(idea.id, phase)}
                      disabled={voted}
                      className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-45"
                      style={
                        mine
                          ? { background: accentVar, color: "#fff" }
                          : { background: "var(--surface-2)", color: "var(--text)" }
                      }
                    >
                      {mine ? "oyun ✓" : voted ? "—" : "oy ver"}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
