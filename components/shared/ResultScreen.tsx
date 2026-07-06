"use client";

import { useEffect } from "react";
import { motion } from "motion/react";
import confetti from "canvas-confetti";
import { Avatars } from "./Avatars";
import { soft, type Accent } from "@/lib/accent";
import type { Idea } from "@/lib/types";

export function ResultScreen({
  winner,
  accent,
  squad,
  fireConfetti = true,
}: {
  winner: Idea | null;
  accent: Accent;
  squad?: string[];
  fireConfetti?: boolean;
}) {
  useEffect(() => {
    if (!fireConfetti) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    confetti({ particleCount: 140, spread: 82, origin: { y: 0.5 }, colors: [accent.base, accent.light, "#EDEDED", "#E7A93F"] });
  }, [fireConfetti, accent]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className="overflow-hidden rounded-[26px] p-10 text-center md:p-14"
      style={{ background: "#161616", color: "#EDEDED", boxShadow: `0 30px 90px -50px ${soft(accent, 0.5)}` }}
    >
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.3em]" style={{ color: accent.base }}>Kazanan</p>
      <motion.h2
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
        className="font-display mt-4 text-[clamp(2.4rem,6vw,3.6rem)] font-bold leading-[1.02]"
        style={{ color: accent.base, textShadow: `0 20px 80px ${soft(accent, 0.3)}` }}
      >
        {winner?.text ?? "—"}
      </motion.h2>
      {winner?.vote_count ? <p className="mt-3 text-sm" style={{ color: "#9A9A9A" }}>{winner.vote_count} oy ile</p> : null}

      {squad && squad.length > 0 && (
        <div className="mt-8 flex flex-col items-center gap-3 border-t pt-7" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.25em]" style={{ color: "#9A9A9A" }}>Squad</p>
          <Avatars names={squad} max={8} ring="#161616" />
          <p className="text-sm" style={{ color: "#9A9A9A" }}>{squad.join(" · ")}</p>
        </div>
      )}
    </motion.div>
  );
}
