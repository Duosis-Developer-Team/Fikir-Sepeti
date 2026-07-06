"use client";

import Link from "next/link";
import { useMemo } from "react";
import { motion } from "motion/react";
import { useRealtimeVotes } from "@/lib/useRealtimeVotes";
import { addIdea, resolveBasket, setBasketPhase, setFinalists } from "@/lib/db";
import { IdeaInput } from "@/components/social/IdeaInput";
import { LiveVotePanel } from "@/components/shared/LiveVotePanel";
import { ResultScreen } from "@/components/shared/ResultScreen";
import { Avatars } from "@/components/shared/Avatars";
import { PhaseBar } from "./PhaseBar";
import { DemoCard } from "./DemoCard";
import { SquadPicker } from "./SquadPicker";
import { soft, type Accent } from "@/lib/accent";
import type { Basket, Idea } from "@/lib/types";

const FINALIST_COUNT = 3;

export function BuildBasket({ basket: initial, voter, accent }: { basket: Basket; voter: string; accent: Accent }) {
  const { basket, ideas, myVotes, connected, vote } = useRealtimeVotes(initial.id, voter);
  const b = basket ?? initial;
  const finalists = useMemo(() => ideas.filter((i) => i.is_finalist), [ideas]);
  const totalVotes = useMemo(() => ideas.reduce((s, i) => s + i.vote_count, 0), [ideas]);
  const authors = useMemo(() => {
    const s = new Set<string>();
    if (b.created_by) s.add(b.created_by);
    ideas.forEach((i) => i.created_by && s.add(i.created_by));
    return [...s];
  }, [ideas, b.created_by]);

  const winner = useMemo<Idea | null>(() => {
    if (b.winner_idea_id) return ideas.find((i) => i.id === b.winner_idea_id) ?? null;
    if (!finalists.length) return null;
    return [...finalists].sort((a, c) => c.vote_count - a.vote_count)[0] ?? null;
  }, [ideas, finalists, b.winner_idea_id]);

  const lockFinalists = async () => {
    const top = [...ideas].sort((a, c) => c.vote_count - a.vote_count).slice(0, FINALIST_COUNT).map((i) => i.id);
    await setFinalists(b.id, top);
    await setBasketPhase(b.id, "demos");
  };
  const advance = (to: Parameters<typeof setBasketPhase>[1]) => setBasketPhase(b.id, to);

  const primary = "w-full rounded-full py-[17px] text-[1.02rem] font-bold transition hover:-translate-y-[2px]";
  const ghost = "w-full rounded-full py-[18px] text-[1rem] font-semibold transition";
  const primaryStyle = { background: accent.base, color: "#161616", boxShadow: `0 18px 44px -18px ${soft(accent, 0.85)}` };
  const ghostStyle = { background: "transparent", border: `1px solid ${soft(accent, 0.4)}`, color: accent.base };

  if (b.status === "resolved") {
    return (
      <div className="flex flex-col gap-7">
        <PhaseBar phase={b.phase} accent={accent} />
        <ResultScreen winner={winner} accent={accent} fireConfetti={false} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      {/* özet şeridi */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl px-5 py-4" style={{ background: "#272727", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-4">
          <Avatars names={authors} size={30} ring="#272727" />
          <span className="tnum text-[0.95rem]" style={{ color: "#9A9A9A" }}>
            <span className="font-bold" style={{ color: "#EDEDED" }}>{ideas.length}</span> fikir · <span className="font-bold" style={{ color: "#EDEDED" }}>{totalVotes}</span> oy
          </span>
        </div>
        <span className="inline-flex items-center gap-[7px] rounded-full px-[13px] py-[6px] text-[0.78rem] font-semibold" style={{ background: soft(accent, 0.12), color: accent.base }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent.base, animation: connected ? "fs-livedot 2s ease-in-out infinite" : "none" }} />
          canlı
        </span>
      </div>

      <PhaseBar phase={b.phase} accent={accent} />

      {b.phase === "ideas" && (
        <div className="flex flex-col gap-3">
          <IdeaInput accent={accent} withTag placeholder="Ne yapalım? (proje fikri)" onAdd={async (text, tag) => { await addIdea({ basket_id: b.id, text, tag, created_by: voter }); }} />
          <div className="flex flex-col gap-[10px]">
            {ideas.map((i) => (
              <motion.div key={i.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 rounded-2xl px-5 py-[14px]" style={{ background: "#272727", border: "1px solid rgba(255,255,255,0.09)" }}>
                <span className="font-display flex-1 text-[1.1rem] font-semibold" style={{ color: "#EDEDED" }}>{i.text}</span>
                {i.tag && <span className="rounded-full px-[11px] py-[5px] text-[0.78rem] font-semibold" style={{ background: soft(accent, 0.14), color: accent.base }}>{i.tag}</span>}
              </motion.div>
            ))}
          </div>
          {ideas.length > 0 && <button onClick={() => advance("finalists")} className={primary} style={primaryStyle}>Finalist oylamasına geç →</button>}
        </div>
      )}

      {b.phase === "finalists" && (
        <div className="flex flex-col gap-3">
          <p className="text-[0.92rem]" style={{ color: "#9A9A9A" }}>En çok oy alan {FINALIST_COUNT} fikir finalist olur.</p>
          <LiveVotePanel ideas={ideas} phase="finalists" myVoteId={myVotes["finalists"]} onVote={vote} accent={accent} />
          <button onClick={lockFinalists} className={ghost} style={ghostStyle}>Finalistleri kilitle</button>
        </div>
      )}

      {b.phase === "demos" && (
        <div className="flex flex-col gap-3">
          <p className="text-[0.92rem]" style={{ color: "#9A9A9A" }}>Her finaliste demo bilgisi gir.</p>
          {finalists.map((i) => <DemoCard key={i.id} idea={i} accent={accent} />)}
          <button onClick={() => advance("voting")} className={primary} style={primaryStyle}>Sunuma hazır →</button>
        </div>
      )}

      {b.phase === "voting" && (
        <div className="flex flex-col gap-3">
          <Link href={`/basket/${b.id}/present`} target="_blank" className="block w-full rounded-2xl py-[19px] text-center text-[1.05rem] font-semibold transition hover:-translate-y-[2px]" style={{ background: "#EDEDED", color: "#161616" }}>
            Presenter modunu aç ↗
          </Link>
          <p className="text-center text-[0.92rem]" style={{ color: "#9A9A9A" }}>Sahnedeki demoya telefonundan oy ver.</p>
          <LiveVotePanel ideas={finalists} phase="voting" myVoteId={myVotes["voting"]} onVote={vote} accent={accent} />
          <button onClick={() => advance("squad")} className={ghost} style={ghostStyle}>Oylamayı bitir → squad</button>
        </div>
      )}

      {b.phase === "squad" && (
        <SquadPicker basketId={b.id} winner={winner} voter={voter} accent={accent} onResolve={() => winner && resolveBasket(b.id, winner.id)} />
      )}
    </div>
  );
}
