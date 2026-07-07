"use client";

import { useMemo } from "react";
import { useRealtimeVotes } from "@/lib/useRealtimeVotes";
import { addIdea, resolveBasket } from "@/lib/db";
import { LiveVotePanel } from "@/components/shared/LiveVotePanel";
import { ResultScreen } from "@/components/shared/ResultScreen";
import { Avatars } from "@/components/shared/Avatars";
import { IdeaInput } from "./IdeaInput";
import { RaffleReveal } from "./RaffleReveal";
import { soft, type Accent } from "@/lib/accent";
import type { Basket } from "@/lib/types";

export function SocialBasket({ basket: initial, voter, accent }: { basket: Basket; voter: string; accent: Accent }) {
  const { basket, ideas, myVotes, connected, vote } = useRealtimeVotes(initial.id, voter);
  const b = basket ?? initial;
  const isRaffle = b.resolve_method === "raffle";
  const owner = b.created_by ?? "Sepeti açan";
  const isOwner = Boolean(voter) && voter === b.created_by;

  const winner = useMemo(() => ideas.find((i) => i.id === b.winner_idea_id) ?? null, [ideas, b.winner_idea_id]);
  const totalVotes = useMemo(() => ideas.reduce((s, i) => s + i.vote_count, 0), [ideas]);
  const authors = useMemo(() => {
    const s = new Set<string>();
    if (b.created_by) s.add(b.created_by);
    ideas.forEach((i) => i.created_by && s.add(i.created_by));
    return [...s];
  }, [ideas, b.created_by]);

  const resolveByVote = async () => {
    if (!ideas.length) return;
    const top = [...ideas].sort((a, c) => c.vote_count - a.vote_count)[0];
    await resolveBasket(b.id, top.id);
  };

  if (b.status === "resolved") return <ResultScreen winner={winner} accent={accent} />;

  return (
    <div className="flex flex-col gap-7">
      {/* özet şeridi */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl px-5 py-4" style={{ background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.08)" }}>
        <div className="flex items-center gap-4">
          <Avatars names={authors} size={30} ring="var(--card)" />
          <span className="tnum text-[0.95rem]" style={{ color: "var(--text-muted)" }}>
            <span className="font-bold" style={{ color: "var(--text)" }}>{ideas.length}</span> {isRaffle ? "aday" : "fikir"}
            {!isRaffle && <> · <span className="font-bold" style={{ color: "var(--text)" }}>{totalVotes}</span> oy</>}
          </span>
        </div>
        <span className="inline-flex items-center gap-[7px] rounded-full px-[13px] py-[6px] text-[0.78rem] font-semibold" style={{ background: soft(accent, 0.12), color: accent.base }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent.base, animation: connected ? "fs-livedot 2s ease-in-out infinite" : "none" }} />
          {isRaffle ? "kura" : "canlı"}
        </span>
      </div>

      {/* mantık açıklaması */}
      <p className="-mt-2 text-[0.9rem] leading-relaxed" style={{ color: "var(--text-muted)" }}>
        {isRaffle ? (
          <>Oy yok — herkes aday ekler, <span className="font-semibold" style={{ color: "var(--text)" }}>{owner}</span> kurayı çeker ve kazananı <span className="font-semibold" style={{ color: accent.base }}>şans</span> belirler.</>
        ) : (
          <>Herkes oy verir; sonucu <span className="font-semibold" style={{ color: "var(--text)" }}>{owner}</span> çeker, <span className="font-semibold" style={{ color: accent.base }}>en çok oyu alan</span> kazanır.</>
        )}
      </p>

      {isRaffle ? (
        <RaffleReveal basket={b} ideas={ideas} voter={voter} accent={accent} isOwner={isOwner} onWinner={(w) => resolveBasket(b.id, w.id)} />
      ) : (
        <>
          <IdeaInput accent={accent} onAdd={async (text, tag) => { await addIdea({ basket_id: b.id, text, tag, created_by: voter }); }} />
          <LiveVotePanel ideas={ideas} phase="ideas" myVoteId={myVotes["ideas"]} onVote={vote} accent={accent} />
          {ideas.length > 0 && (
            isOwner ? (
              <button
                onClick={resolveByVote}
                className="w-full rounded-full py-[17px] text-[1.02rem] font-bold transition hover:-translate-y-[2px]"
                style={{ background: accent.base, color: "#0F0F0F", boxShadow: `0 18px 44px -18px ${soft(accent, 0.85)}` }}
              >
                Oylamayı bitir — en çok oyu alan kazansın
              </button>
            ) : (
              <div className="rounded-full py-[15px] text-center text-[0.92rem]" style={{ background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.08)", color: "var(--text-muted)" }}>
                Oyunu ver — sonucu <span className="font-semibold" style={{ color: "var(--text)" }}>{owner}</span> çekecek.
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}
