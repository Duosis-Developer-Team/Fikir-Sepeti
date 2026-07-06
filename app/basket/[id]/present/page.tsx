"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useParams } from "next/navigation";
import { useNameContext } from "@/components/NameGate";
import { useRealtimeVotes } from "@/lib/useRealtimeVotes";
import { setCurrentDemoIdx } from "@/lib/db";
import { LiveVotePanel } from "@/components/shared/LiveVotePanel";
import type { Idea } from "@/lib/types";

export default function PresenterPage() {
  const { id } = useParams<{ id: string }>();
  const { name } = useNameContext();
  const { basket, ideas, connected } = useRealtimeVotes(id, name || "presenter");

  const finalists = useMemo<Idea[]>(() => ideas.filter((i) => i.is_finalist), [ideas]);
  const idx = Math.min(basket?.current_demo_idx ?? 0, Math.max(0, finalists.length - 1));
  const current = finalists[idx];
  const totalVotes = finalists.reduce((s, i) => s + i.vote_count, 0);

  const go = (delta: number) => {
    const next = Math.max(0, Math.min(finalists.length - 1, idx + delta));
    if (next !== idx) void setCurrentDemoIdx(id, next);
  };

  return (
    <main className="presenter-stage flex min-h-screen flex-col px-10 py-8">
      {/* üst bar */}
      <div className="flex items-center justify-between text-white/70">
        <span className="text-lg font-medium">
          {finalists.length > 0 ? `${idx + 1}/${finalists.length} demo` : "demo yok"}
          <span className="ml-3 text-white/40">·</span>
          <span
            className="ml-3 inline-flex items-center gap-2 text-base"
            style={{ color: connected ? "#7de0bb" : undefined }}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: connected ? "#3ddc97" : "#888" }}
            />
            {connected ? "canlı" : "bağlanıyor…"}
          </span>
        </span>
        <span className="text-lg tabular-nums">{totalVotes} oy</span>
      </div>

      {/* sahne */}
      <div className="flex flex-1 flex-col justify-center py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={current?.id ?? "empty"}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {current ? (
              <>
                {current.tag && (
                  <span
                    className="inline-block rounded-full px-3 py-1 text-sm"
                    style={{ background: "rgba(83,74,183,0.25)", color: "#c3bdf5" }}
                  >
                    {current.tag}
                  </span>
                )}
                <h1 className="mt-4 text-5xl font-medium leading-tight text-white">
                  {current.text}
                </h1>
                <p className="mt-3 text-xl text-white/60">
                  {current.presenter ?? "—"}
                  {current.live_at ? ` · ${current.live_at}` : ""}
                </p>
                {current.demo_url && (
                  <a
                    href={current.demo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 inline-block rounded-lg border border-white/20 px-5 py-2.5 text-base text-white/90 transition hover:bg-white/10"
                  >
                    Demoyu aç ↗
                  </a>
                )}
              </>
            ) : (
              <h1 className="text-3xl text-white/50">Finalist demosu yok.</h1>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* canlı oylama barı (dev boyut, sadece lider mor) */}
      <div className="mt-auto">
        <LiveVotePanel
          ideas={finalists}
          phase="voting"
          accent="build"
          size="presenter"
          leaderOnly
        />
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => go(-1)}
            disabled={idx <= 0}
            className="rounded-lg border border-white/20 px-6 py-3 text-base text-white/90 transition hover:bg-white/10 disabled:opacity-30"
          >
            ← Önceki
          </button>
          <button
            onClick={() => go(1)}
            disabled={idx >= finalists.length - 1}
            className="rounded-lg px-6 py-3 text-base font-medium text-white transition disabled:opacity-30"
            style={{ background: "var(--accent-build)" }}
          >
            Sonraki demo →
          </button>
        </div>
      </div>
    </main>
  );
}
