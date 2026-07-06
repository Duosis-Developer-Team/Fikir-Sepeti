"use client";

import { useState } from "react";
import { motion } from "motion/react";
import confetti from "canvas-confetti";
import type { Idea } from "@/lib/types";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// hızlanma→yavaşlama profili (artan gecikme)
const DELAYS = [70, 70, 80, 80, 90, 110, 140, 180, 230, 300, 390, 500];

export function RaffleReveal({
  ideas,
  onWinner,
}: {
  ideas: Idea[];
  onWinner: (winner: Idea) => void;
}) {
  const [phase, setPhase] = useState<"idle" | "spinning" | "done">("idle");
  const [active, setActive] = useState<number>(-1);
  const [winnerId, setWinnerId] = useState<string | null>(null);

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const run = async () => {
    if (ideas.length === 0 || phase === "spinning") return;
    // kazananı ÖNCE seç — animasyon sadece görsel.
    const winnerIndex = Math.floor(Math.random() * ideas.length);
    const winner = ideas[winnerIndex];
    setWinnerId(winner.id);
    setPhase("spinning");

    if (reduced) {
      setActive(winnerIndex);
    } else {
      let idx = 0;
      for (let s = 0; s < DELAYS.length; s++) {
        idx = s === DELAYS.length - 1 ? winnerIndex : (idx + 1) % ideas.length;
        setActive(idx);
        await wait(DELAYS[s]);
      }
    }

    setPhase("done");
    if (!reduced) {
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
    }
    await wait(700);
    onWinner(winner);
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {ideas.map((idea, i) => {
          const isActive = active === i && phase === "spinning";
          const isWinner = phase === "done" && winnerId === idea.id;
          return (
            <motion.div
              key={idea.id}
              animate={{
                scale: isWinner ? 1.06 : isActive ? 1.04 : 1,
                opacity: phase === "done" && !isWinner ? 0.4 : 1,
              }}
              transition={{ type: "spring", stiffness: 500, damping: 24 }}
              className="flex min-h-[68px] items-center justify-center rounded-[var(--radius)] border p-3 text-center text-sm font-medium"
              style={{
                borderColor: isWinner || isActive ? "var(--accent-social)" : "var(--border)",
                background:
                  isWinner || isActive ? "var(--accent-social-soft)" : "var(--surface)",
                boxShadow: isWinner ? "0 0 0 4px rgba(29,158,117,0.18)" : undefined,
              }}
            >
              {idea.text}
            </motion.div>
          );
        })}
      </div>

      {phase !== "done" && (
        <button
          onClick={run}
          disabled={phase === "spinning" || ideas.length === 0}
          className="mt-5 w-full rounded-lg py-3 text-sm font-medium text-white transition disabled:opacity-45"
          style={{ background: "var(--accent-social)" }}
        >
          {phase === "spinning" ? "Çekiliyor…" : "Kurayı çek"}
        </button>
      )}
    </div>
  );
}
