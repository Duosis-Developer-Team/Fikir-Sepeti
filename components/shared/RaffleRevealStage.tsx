"use client";

import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { soft, type Accent } from "@/lib/accent";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

function fireConfetti() {
  if (prefersReducedMotion()) return;
  void confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
}

export type RaffleRevealStageProps = {
  title: string;
  labels: string[];
  winnerLabel: string;
  accent: Accent;
  /** When false, skip animation and call onComplete immediately on mount. */
  enabled?: boolean;
  eyebrow?: string;
  winnerCaption?: string;
  onComplete: () => void;
  onSkip?: () => void;
  /** Optional secondary action after reveal (e.g. confirm). If absent, Skip/auto completes. */
  confirmLabel?: string;
  onConfirm?: () => void;
};

/**
 * Pure visual raffle: winner is already chosen; this only stages shuffle → lock → confetti.
 * Shared by social RaffleReveal and hackathon idea/assignment reveals.
 */
export function RaffleRevealStage({
  title,
  labels,
  winnerLabel,
  accent,
  enabled = true,
  eyebrow = "Kura çekiliyor",
  winnerCaption,
  onComplete,
  onSkip,
  confirmLabel,
  onConfirm,
}: RaffleRevealStageProps) {
  const [phase, setPhase] = useState<"rolling" | "revealed">(
    !enabled || prefersReducedMotion() || labels.length < 2 ? "revealed" : "rolling"
  );
  const [name, setName] = useState(
    !enabled || prefersReducedMotion() || labels.length < 2 ? winnerLabel : labels[0] ?? winnerLabel
  );
  const rollT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const started = useRef(false);
  const confettiDone = useRef(false);

  useEffect(() => () => {
    if (rollT.current) clearTimeout(rollT.current);
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (!enabled || prefersReducedMotion() || labels.length < 2) {
      setName(winnerLabel);
      setPhase("revealed");
      if (enabled && !confettiDone.current && labels.length >= 1) {
        // reduced motion: no confetti
      }
      if (!confirmLabel) {
        const t = setTimeout(() => onComplete(), 400);
        return () => clearTimeout(t);
      }
      return;
    }

    let i = 1;
    let delay = 60;
    setPhase("rolling");
    setName(labels[0] ?? winnerLabel);

    const roll = () => {
      setName(labels[i % labels.length]);
      i++;
      delay *= 1.15;
      if (delay < 330) {
        rollT.current = setTimeout(roll, delay);
      } else {
        rollT.current = setTimeout(() => {
          setName(winnerLabel);
          setPhase("revealed");
          if (!confettiDone.current) {
            confettiDone.current = true;
            fireConfetti();
          }
          if (!confirmLabel) {
            rollT.current = setTimeout(() => onComplete(), 900);
          }
        }, delay);
      }
    };

    void wait(60).then(roll);
  }, [enabled, labels, winnerLabel, onComplete, confirmLabel]);

  const revealed = phase === "revealed";
  const chrome = { opacity: 0.28, transition: "opacity 400ms ease" };

  const skip = () => {
    if (rollT.current) clearTimeout(rollT.current);
    setName(winnerLabel);
    setPhase("revealed");
    if (onSkip) onSkip();
    else onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" style={{ background: "#0F0F0F" }} data-testid="raffle-stage">
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 42%, transparent 40%, rgba(0,0,0,0.6) 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute z-[2]"
        style={{
          left: "50%",
          bottom: "-8%",
          width: "90vw",
          maxWidth: 1100,
          height: "80vh",
          transform: `translateX(-50%) scale(${revealed ? 1 : 0.7})`,
          background: `radial-gradient(50% 55% at 50% 60%, ${soft(accent, 0.5)} 0%, ${soft(accent, 0.14)} 42%, transparent 70%)`,
          filter: "blur(18px)",
          opacity: revealed ? 1 : 0,
          transition: "opacity 620ms ease, transform 720ms cubic-bezier(.16,1.05,.3,1)",
        }}
      />

      <button
        type="button"
        onClick={skip}
        className="absolute right-[30px] top-[28px] z-[8] rounded-full px-4 py-[9px] text-[0.9rem]"
        style={{ background: "rgba(var(--border-rgb),0.06)", color: "var(--text-muted)" }}
        data-testid="raffle-skip"
      >
        Atla ✕
      </button>

      <div className="relative z-[3] flex h-full flex-col px-[clamp(24px,5vw,72px)] pb-14 pt-10">
        <div className="flex items-center gap-[10px]" style={chrome}>
          <span className="h-2 w-2 rounded-full" style={{ background: accent.base }} />
          <span
            className="text-[0.72rem] font-semibold uppercase tracking-[0.26em]"
            style={{ color: accent.base }}
          >
            {eyebrow}
          </span>
        </div>
        <h2
          className="font-display mt-3 max-w-[16ch] text-[clamp(1.6rem,3.4vw,2.6rem)] font-semibold leading-[1.05]"
          style={{ ...chrome, color: "var(--text)" }}
        >
          {title}
        </h2>

        <div className="flex flex-1 flex-col items-center justify-center gap-[18px] text-center">
          <span
            className="text-[0.82rem] font-semibold uppercase tracking-[0.34em]"
            style={{
              color: accent.base,
              opacity: revealed ? 1 : 0,
              transition: "opacity 500ms ease 240ms",
            }}
          >
            {winnerCaption ?? "Kazanan"}
          </span>
          <div
            className="font-display"
            data-testid="raffle-winner"
            style={{
              fontWeight: 700,
              letterSpacing: "-0.035em",
              lineHeight: 0.95,
              fontSize: "clamp(2.2rem,8vw,6.5rem)",
              color: revealed ? accent.base : "#7A7A7A",
              transform: revealed ? "scale(1)" : "scale(0.9)",
              textShadow: revealed ? `0 20px 80px ${soft(accent, 0.35)}` : "none",
              transition: "color 220ms ease, transform 520ms cubic-bezier(.16,1.1,.3,1)",
            }}
          >
            {name}
          </div>
          <span
            className="text-[1.05rem]"
            style={{
              color: "var(--text-muted)",
              opacity: revealed ? 1 : 0,
              transition: "opacity 600ms ease 340ms",
            }}
          >
            {labels.length} aday arasından çekildi
          </span>
          {confirmLabel && onConfirm && (
            <div
              className="mt-3 flex gap-3"
              style={{ opacity: revealed ? 1 : 0, transition: "opacity 500ms ease 440ms" }}
            >
              <button
                type="button"
                onClick={onConfirm}
                className="rounded-full px-[26px] py-3 text-[0.95rem] font-bold"
                style={{ background: accent.base, color: "#0F0F0F" }}
                data-testid="raffle-confirm"
              >
                {confirmLabel}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
