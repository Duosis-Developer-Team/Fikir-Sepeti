"use client";

import { useEffect, useRef, useState } from "react";
import { GOLD, GOLD_SOFT, dim } from "./contract";

/**
 * Sıralı takım turu başlığı — DemoStage (rubrik) ve FeedbackStage paylaşır.
 * Süre dolunca ya da gereken herkes bitirince admin tarafında otomatik "sıradakine
 * geç" tetiklenir; herkes aynı anda görür (team_turn_idx/ends_at realtime senkron).
 */
export function TeamTurnBar({
  teamName,
  idx,
  teamCount,
  endsAt,
  reviewDone,
  reviewTotal,
  complete,
  isAdmin,
  readOnly,
  onAdvance,
}: {
  teamName: string | null;
  idx: number;
  teamCount: number;
  endsAt: string | null;
  reviewDone: number;
  reviewTotal: number;
  complete: boolean;
  isAdmin: boolean;
  readOnly: boolean;
  onAdvance: () => void;
}) {
  const [now, setNow] = useState<number | null>(null);
  const hasNext = idx < teamCount - 1;

  useEffect(() => {
    if (!endsAt) {
      setNow(null);
      return;
    }
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [endsAt]);

  const endsAtMs = endsAt ? new Date(endsAt).getTime() : null;
  const remain = endsAtMs !== null && now !== null ? Math.max(0, endsAtMs - now) : null;
  const timeUp = remain !== null && remain <= 0;

  // Aynı idx için en fazla bir kez otomatik ilerlet — DB round-trip dönene kadar
  // props aynı kalabilir, tekrar tekrar advance çağırmayı engeller.
  const advancedFor = useRef<number | null>(null);
  useEffect(() => {
    if (!isAdmin || readOnly || !hasNext) return;
    if ((complete || timeUp) && advancedFor.current !== idx) {
      advancedFor.current = idx;
      onAdvance();
    }
  }, [complete, timeUp, isAdmin, readOnly, hasNext, idx, onAdvance]);

  const mm = remain !== null ? Math.floor(remain / 60_000) : null;
  const ss = remain !== null ? Math.floor((remain % 60_000) / 1000) : null;

  return (
    <div
      className="mb-6 flex flex-col items-center gap-2 rounded-[22px] px-6 py-5 text-center"
      style={{ background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.09)" }}
      data-testid="team-turn-bar"
    >
      <span className="text-[0.7rem] font-bold uppercase tracking-[0.22em]" style={{ color: dim(0.45) }}>
        Takım {idx + 1} / {teamCount}
      </span>
      <span className="font-display text-[1.6rem] font-bold" style={{ color: GOLD }}>{teamName ?? "—"}</span>
      <div className="flex items-center gap-3">
        {reviewTotal > 0 && (
          <span className="text-[0.85rem]" style={{ color: dim(0.55) }} data-testid="team-turn-progress">
            {reviewDone}/{reviewTotal} kişi bitirdi
          </span>
        )}
        {remain !== null && (
          <span className="tnum text-[0.9rem] font-semibold" style={{ color: timeUp ? "#F2795F" : GOLD_SOFT }}>
            {timeUp ? "süre doldu" : `${mm}:${String(ss).padStart(2, "0")}`}
          </span>
        )}
      </div>
      {isAdmin && !readOnly && hasNext && (
        <button
          type="button"
          onClick={onAdvance}
          className="mt-1 rounded-full px-5 py-2 text-[0.82rem] font-semibold transition hover:opacity-80"
          style={{ border: "1px solid rgba(var(--border-rgb),0.2)", color: dim(0.85) }}
          data-testid="team-turn-skip"
        >
          Sıradaki takıma geç →
        </button>
      )}
      {!hasNext && complete && (
        <span className="mt-1 text-[0.85rem]" style={{ color: "#6FD9B4" }}>✓ Son takım da tamamlandı</span>
      )}
    </div>
  );
}
