"use client";

import { useEffect } from "react";
import { motion } from "motion/react";
import confetti from "canvas-confetti";
import type { Idea } from "@/lib/types";

export function ResultScreen({
  winner,
  accent = "social",
  squad,
  fireConfetti = true,
}: {
  winner: Idea | null;
  accent?: "social" | "build";
  squad?: string[];
  fireConfetti?: boolean;
}) {
  const accentVar = accent === "build" ? "var(--accent-build)" : "var(--accent-social)";

  useEffect(() => {
    if (!fireConfetti) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
  }, [fireConfetti]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 26 }}
      className="rounded-[var(--radius)] border p-8 text-center"
      style={{ borderColor: accentVar, boxShadow: `0 0 0 4px ${accentVar}14` }}
    >
      <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Kazanan</p>
      <p className="mt-2 text-2xl font-medium" style={{ color: accentVar }}>
        {winner?.text ?? "—"}
      </p>
      {winner?.vote_count ? (
        <p className="mt-1 text-sm text-[var(--text-muted)]">{winner.vote_count} oy</p>
      ) : null}

      {squad && squad.length > 0 && (
        <div className="mt-6 border-t border-[var(--border)] pt-5">
          <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Squad</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {squad.map((m) => (
              <span
                key={m}
                className="rounded-full px-3 py-1 text-sm"
                style={{ background: `${accentVar}14`, color: accentVar }}
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
