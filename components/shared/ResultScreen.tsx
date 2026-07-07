"use client";

import { motion } from "motion/react";
import { Avatars } from "./Avatars";
import { soft, type Accent } from "@/lib/accent";
import type { Idea } from "@/lib/types";

export function ResultScreen({
  winner,
  accent,
  squad,
}: {
  winner: Idea | null;
  accent: Accent;
  squad?: string[];
  fireConfetti?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className="relative overflow-hidden rounded-[26px] p-10 text-center md:p-14"
      style={{ background: "#0F0F0F", color: "var(--text)", boxShadow: `0 30px 90px -50px ${soft(accent, 0.5)}` }}
    >
      {/* sade bloom — konfeti yerine */}
      <motion.span
        className="pointer-events-none absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[80px]"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 0.5, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        style={{ background: soft(accent, 0.5) }}
        aria-hidden
      />
      <p className="relative text-[0.72rem] font-semibold uppercase tracking-[0.3em]" style={{ color: accent.base }}>Kazanan</p>
      <motion.h2
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
        className="font-display relative mt-4 text-[clamp(2.4rem,6vw,3.6rem)] font-bold leading-[1.02]"
        style={{ color: accent.base, textShadow: `0 20px 80px ${soft(accent, 0.35)}` }}
      >
        {winner?.text ?? "—"}
      </motion.h2>
      {winner?.vote_count ? <p className="relative mt-3 text-sm" style={{ color: "var(--text-muted)" }}>{winner.vote_count} oy ile</p> : null}

      {squad && squad.length > 0 && (
        <div className="relative mt-8 flex flex-col items-center gap-3 border-t pt-7" style={{ borderColor: "rgba(var(--border-rgb),0.1)" }}>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.25em]" style={{ color: "var(--text-muted)" }}>Squad</p>
          <Avatars names={squad} max={8} ring="#0F0F0F" />
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>{squad.join(" · ")}</p>
        </div>
      )}
    </motion.div>
  );
}
