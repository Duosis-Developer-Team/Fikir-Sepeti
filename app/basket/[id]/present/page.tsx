"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";
import { useNameContext } from "@/components/NameGate";
import { useRealtimeVotes } from "@/lib/useRealtimeVotes";
import { setCurrentDemoIdx } from "@/lib/db";
import { AnimatedNumber } from "@/components/shared/AnimatedNumber";
import type { Idea } from "@/lib/types";

const GOLD = "#E7A93F";
const GOLD_SOFT = "#EEC078";
const PAPER = "#F4F1EA";
const dim = (a: number) => `rgba(244,241,234,${a})`;

/** Küçük yatay "tara-katıl" kartı — QR solda, yazı sağında. */
function VoteQR({ id }: { id: string }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const target = `${window.location.origin}/basket/${id}`;
    QRCode.toDataURL(target, { margin: 1, width: 360, color: { dark: "#17150F", light: "#FFFFFF" } }).then(setUrl).catch(() => {});
  }, [id]);
  return (
    <div className="flex items-center gap-5 rounded-[20px] p-[18px]" style={{ background: "#FBFAF7", boxShadow: "0 24px 60px -34px rgba(0,0,0,0.8)" }}>
      <div className="flex flex-col pl-1">
        <p className="font-display text-[1.38rem] font-bold leading-[1.12]" style={{ color: "#17150F" }}>Telefonundan<br />oy ver</p>
        <p className="mt-2 text-[1.06rem]" style={{ color: "#8A857B" }}>QR&apos;ı okut →</p>
      </div>
      {url ? <img src={url} alt="oy ver QR" className="h-[130px] w-[130px] rounded-lg" /> : <div className="h-[130px] w-[130px] rounded-lg" style={{ background: "#eee" }} />}
    </div>
  );
}

export default function PresenterPage() {
  const { id } = useParams<{ id: string }>();
  const { name } = useNameContext();
  const { basket, ideas } = useRealtimeVotes(id, name || "presenter");
  const isOwner = Boolean(name) && basket?.created_by === name;

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
    <main className="presenter-stage h-screen overflow-hidden">
      <div className="mx-auto flex h-full max-w-[1600px] flex-col gap-[clamp(20px,3vh,36px)] px-[clamp(28px,5vw,72px)] py-[clamp(24px,3.5vw,44px)]">

        {/* ── üst: sahnedeki demo + QR ── */}
        <header className="flex shrink-0 items-center justify-between gap-8">
          <div className="min-w-0">
            <span className="text-[0.9rem] font-semibold uppercase tracking-[0.28em]" style={{ color: GOLD }}>Şu an sahnede · {finalists.length ? `${idx + 1}/${finalists.length}` : "—"}</span>
            <h1 className="font-display mt-3 truncate text-[clamp(2.4rem,4.25vw,3.75rem)] font-extrabold leading-none tracking-tight" style={{ color: PAPER }}>
              {current?.text ?? "Finalist demosu yok"}
            </h1>
            {current && (
              <div className="mt-2.5 flex flex-wrap items-center gap-3.5 text-[1.25rem]" style={{ color: dim(0.55) }}>
                <span style={{ color: dim(0.8) }}>{current.presenter ?? "—"}</span>
                {current.live_at && <><span className="opacity-40">·</span><span>{current.live_at}</span></>}
                {current.tag && <span className="rounded-full px-3.5 py-1 text-[1.06rem] font-semibold" style={{ background: "rgba(231,169,63,0.15)", color: GOLD_SOFT }}>{current.tag}</span>}
                {current.demo_url && <a href={current.demo_url} target="_blank" rel="noreferrer" className="rounded-full border px-4 py-1.5 text-[1.06rem] transition hover:bg-white/10" style={{ borderColor: "rgba(255,255,255,0.22)", color: dim(0.85) }}>Demoyu aç ↗</a>}
              </div>
            )}
          </div>
          {finalists.length > 0 && <div className="shrink-0"><VoteQR id={id} /></div>}
        </header>

        {/* ── skorboard: barlar ekranı doldurur ── */}
        <div className="flex items-baseline justify-between px-1">
          <span className="text-[0.72rem] font-semibold uppercase tracking-[0.28em]" style={{ color: dim(0.45) }}>Canlı sıralama</span>
          <span className="text-[1rem]" style={{ color: dim(0.5) }}><span className="font-display font-bold" style={{ color: PAPER }}>{totalVotes}</span> oy verildi</span>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-[clamp(10px,1.6vh,18px)]">
          <AnimatePresence initial={false}>
            {sorted.map((idea, rank) => {
              const pct = (idea.vote_count / max) * 100;
              const lead = idea.vote_count === leaderCount && leaderCount > 0;
              const onStage = idea.id === current?.id;
              return (
                <motion.div
                  key={idea.id}
                  layout
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="relative flex-1 overflow-hidden rounded-[20px]"
                  style={{
                    background: "rgba(255,255,255,0.035)",
                    border: `1px solid ${lead ? GOLD : "rgba(255,255,255,0.08)"}`,
                    boxShadow: lead ? "0 16px 60px -26px rgba(231,169,63,0.7)" : "none",
                  }}
                >
                  <motion.div
                    className="absolute inset-y-0 left-0"
                    initial={false}
                    animate={{ width: `${pct}%` }}
                    transition={{ type: "spring", stiffness: 140, damping: 26 }}
                    style={{ background: lead ? "rgba(231,169,63,0.2)" : "rgba(255,255,255,0.05)" }}
                  />
                  <div className="relative flex h-full items-center gap-6 px-[clamp(20px,2.5vw,40px)]">
                    <span className="tnum font-display w-10 shrink-0 text-[clamp(1.6rem,2.4vw,2.4rem)] font-bold" style={{ color: lead ? GOLD_SOFT : dim(0.32) }}>{rank + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-display truncate text-[clamp(1.6rem,2.8vw,2.6rem)] font-extrabold leading-tight" style={{ color: PAPER }}>{idea.text}</p>
                      <p className="mt-0.5 truncate text-[clamp(0.85rem,1.1vw,1.05rem)]" style={{ color: dim(0.45) }}>
                        {onStage ? <span style={{ color: GOLD_SOFT }}>● sahnede{idea.presenter ? ` · ${idea.presenter}` : ""}</span> : (idea.presenter ?? "—")}
                      </p>
                    </div>
                    <AnimatedNumber value={idea.vote_count} className="font-display shrink-0 text-[clamp(2.8rem,5.5vw,5.5rem)] font-extrabold tabular-nums leading-none" style={{ color: lead ? GOLD : dim(0.85) }} />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* ── kontroller ── */}
        {isOwner ? (
          <div className="flex shrink-0 items-center justify-center gap-4">
            <button onClick={() => go(-1)} disabled={idx <= 0} className="rounded-full border px-7 py-3 text-[1rem] transition hover:bg-white/10 disabled:opacity-25" style={{ borderColor: "rgba(255,255,255,0.2)", color: dim(0.9) }}>← Önceki</button>
            <button onClick={() => go(1)} disabled={idx >= finalists.length - 1} className="rounded-full px-9 py-3 text-[1rem] font-semibold transition hover:opacity-90 disabled:opacity-25" style={{ background: GOLD, color: "#17150F" }}>Sonraki demo →</button>
          </div>
        ) : (
          <p className="shrink-0 text-center text-[1rem]" style={{ color: dim(0.4) }}>
            Sahneyi {basket?.created_by ?? "sunan"} yönetiyor — sen telefonundan oy ver.
          </p>
        )}
      </div>
    </main>
  );
}
