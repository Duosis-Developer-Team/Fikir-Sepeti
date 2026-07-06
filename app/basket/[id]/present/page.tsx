"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useParams } from "next/navigation";
import { useNameContext } from "@/components/NameGate";
import { useRealtimeVotes } from "@/lib/useRealtimeVotes";
import { setCurrentDemoIdx } from "@/lib/db";
import { AnimatedNumber } from "@/components/shared/AnimatedNumber";
import type { Idea } from "@/lib/types";

const VIOLET = "#E7A93F"; // altın (build)
const PAPER = "#EDEDED";

export default function PresenterPage() {
  const { id } = useParams<{ id: string }>();
  const { name } = useNameContext();
  const { basket, ideas, connected } = useRealtimeVotes(id, name || "presenter");

  const finalists = useMemo<Idea[]>(() => ideas.filter((i) => i.is_finalist), [ideas]);
  const sorted = useMemo(() => [...finalists].sort((a, b) => b.vote_count - a.vote_count), [finalists]);
  const idx = Math.min(basket?.current_demo_idx ?? 0, Math.max(0, finalists.length - 1));
  const current = finalists[idx];
  const totalVotes = finalists.reduce((s, i) => s + i.vote_count, 0);
  const max = Math.max(1, ...sorted.map((i) => i.vote_count));
  const leaderCount = Math.max(0, ...sorted.map((i) => i.vote_count));

  const go = (delta: number) => {
    const next = Math.max(0, Math.min(finalists.length - 1, idx + delta));
    if (next !== idx) void setCurrentDemoIdx(id, next);
  };

  return (
    <main className="presenter-stage flex min-h-screen flex-col px-12 py-9">
      {/* üst bar */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-3 text-lg" style={{ color: "rgba(244,241,234,0.65)" }}>
          <span className="font-display text-2xl font-bold" style={{ color: PAPER }}>
            {finalists.length ? `${idx + 1}/${finalists.length}` : "0"}
          </span>
          demo
          <span className="mx-1 opacity-30">·</span>
          <span className="flex items-center gap-2" style={{ color: connected ? "#57e0a8" : "rgba(244,241,234,0.4)" }}>
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: connected ? "#3ddc97" : "#666", boxShadow: connected ? "0 0 0 5px rgba(61,220,151,0.15)" : "none" }} />
            canlı
          </span>
        </span>
        <span className="flex items-baseline gap-2">
          <AnimatedNumber value={totalVotes} className="font-display text-4xl font-extrabold tabular-nums" style={{ color: PAPER }} />
          <span className="text-lg" style={{ color: "rgba(244,241,234,0.5)" }}>oy</span>
        </span>
      </div>

      {/* sahne */}
      <div className="flex flex-1 flex-col justify-center py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={current?.id ?? "empty"}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
          >
            {current ? (
              <>
                {current.tag && (
                  <span className="inline-block rounded-full px-4 py-1.5 text-base font-semibold" style={{ background: "rgba(231,169,63,0.2)", color: "#EEC078" }}>
                    {current.tag}
                  </span>
                )}
                <h1 className="font-display mt-5 text-7xl font-extrabold leading-[0.98] tracking-tight" style={{ color: PAPER }}>
                  {current.text}
                </h1>
                <p className="mt-5 text-2xl" style={{ color: "rgba(244,241,234,0.55)" }}>
                  {current.presenter ?? "—"}
                  {current.live_at ? `  ·  ${current.live_at}` : ""}
                </p>
                {current.demo_url && (
                  <a
                    href={current.demo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-7 inline-block rounded-full border px-6 py-3 text-lg transition hover:bg-white/10"
                    style={{ borderColor: "rgba(255,255,255,0.2)", color: "rgba(244,241,234,0.9)" }}
                  >
                    Demoyu aç ↗
                  </a>
                )}
              </>
            ) : (
              <h1 className="font-display text-4xl" style={{ color: "rgba(244,241,234,0.4)" }}>Finalist demosu yok.</h1>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* canlı barlar */}
      <div className="space-y-4">
        <AnimatePresence initial={false}>
          {sorted.map((idea) => {
            const pct = (idea.vote_count / max) * 100;
            const lead = idea.vote_count === leaderCount && leaderCount > 0;
            return (
              <motion.div
                key={idea.id}
                layout
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="relative overflow-hidden rounded-2xl"
                style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${lead ? VIOLET : "rgba(255,255,255,0.08)"}` }}
              >
                <motion.div
                  className="absolute inset-y-0 left-0"
                  initial={false}
                  animate={{ width: `${pct}%` }}
                  transition={{ type: "spring", stiffness: 140, damping: 26 }}
                  style={{ background: lead ? "rgba(231,169,63,0.20)" : "rgba(255,255,255,0.05)" }}
                />
                <div className="relative flex items-center justify-between px-7 py-5">
                  <div>
                    <p className="font-display text-3xl font-bold" style={{ color: PAPER }}>{idea.text}</p>
                    {idea.presenter && (
                      <p className="mt-0.5 text-base" style={{ color: "rgba(244,241,234,0.45)" }}>{idea.presenter}</p>
                    )}
                  </div>
                  <AnimatedNumber value={idea.vote_count} className="font-display text-5xl font-extrabold tabular-nums" style={{ color: lead ? VIOLET : "rgba(244,241,234,0.85)" }} />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => go(-1)}
            disabled={idx <= 0}
            className="rounded-full border px-7 py-3 text-lg transition hover:bg-white/10 disabled:opacity-25"
            style={{ borderColor: "rgba(255,255,255,0.2)", color: "rgba(244,241,234,0.9)" }}
          >
            ← Önceki
          </button>
          <button
            onClick={() => go(1)}
            disabled={idx >= finalists.length - 1}
            className="rounded-full px-7 py-3 text-lg font-semibold text-white transition hover:opacity-90 disabled:opacity-25"
            style={{ background: VIOLET }}
          >
            Sonraki demo →
          </button>
        </div>
      </div>
    </main>
  );
}
