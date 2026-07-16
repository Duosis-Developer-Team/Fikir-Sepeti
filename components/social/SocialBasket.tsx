"use client";

import { useMemo, useState } from "react";
import { useRealtimeVotes } from "@/lib/useRealtimeVotes";
import { addIdea, resolveBasket } from "@/lib/db";
import { markPoolWinner, returnIdeaToPool } from "@/lib/pool";
import { supabase } from "@/lib/supabase";
import { LiveVotePanel } from "@/components/shared/LiveVotePanel";
import { ResultScreen } from "@/components/shared/ResultScreen";
import { Avatars } from "@/components/shared/Avatars";
import { IdeaInput } from "./IdeaInput";
import { RaffleReveal } from "./RaffleReveal";
import { InvitePanel } from "@/components/hackathon/InvitePanel";
import { soft, type Accent } from "@/lib/accent";
import type { Basket } from "@/lib/types";

export function SocialBasket({ basket: initial, voter, accent }: { basket: Basket; voter: string; accent: Accent }) {
  const { basket, ideas, myVotes, connected, vote } = useRealtimeVotes(initial.id, voter);
  const b = basket ?? initial;
  const isRaffle = b.resolve_method === "raffle";
  const owner = b.created_by ?? "Sepeti açan";
  const isOwner = Boolean(voter) && voter === b.created_by;
  const [returned, setReturned] = useState<Set<string>>(new Set());

  const winner = useMemo(() => ideas.find((i) => i.id === b.winner_idea_id) ?? null, [ideas, b.winner_idea_id]);
  const losers = useMemo(
    () => ideas.filter((i) => i.id !== b.winner_idea_id),
    [ideas, b.winner_idea_id]
  );
  const totalVotes = useMemo(() => ideas.reduce((s, i) => s + i.vote_count, 0), [ideas]);
  const authors = useMemo(() => {
    const s = new Set<string>();
    if (b.created_by) s.add(b.created_by);
    ideas.forEach((i) => i.created_by && s.add(i.created_by));
    return [...s];
  }, [ideas, b.created_by]);

  const annotatePool = async (winnerText: string) => {
    const { data } = await supabase
      .from("idea_pool")
      .select("id")
      .eq("promoted_basket_id", b.id)
      .limit(1)
      .maybeSingle();
    if (data?.id) {
      await markPoolWinner({
        pool_idea_id: data.id as string,
        winner_label: winnerText,
        tenant_id: b.tenant_id,
        actor: voter,
      });
    }
  };

  const resolveByVote = async () => {
    if (!ideas.length) return;
    const top = [...ideas].sort((a, c) => c.vote_count - a.vote_count)[0];
    await resolveBasket(b.id, top.id);
    await annotatePool(top.text);
  };

  const sendToJar = async (ideaId: string) => {
    const row = await returnIdeaToPool({
      idea_id: ideaId,
      basket_id: b.id,
      created_by: voter,
      tenant_id: b.tenant_id,
    });
    if (row) setReturned((prev) => new Set(prev).add(ideaId));
  };

  if (b.status === "resolved") {
    return (
      <div className="flex flex-col gap-5">
        <ResultScreen winner={winner} accent={accent} />
        <a
          href={`/basket/${b.id}/result`}
          className="rounded-full py-3 text-center text-[0.95rem] font-semibold"
          style={{ background: soft(accent, 0.14), color: accent.base }}
          data-testid="open-result-page"
        >
          Sonuç tablosu →
        </a>
        {losers.length > 0 && (
          <div
            className="rounded-[22px] p-5"
            style={{ background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.09)" }}
            data-testid="return-to-pool"
          >
            <p className="text-[0.72rem] font-bold uppercase tracking-[0.2em]" style={{ color: "#D97757" }}>
              Kaybedenleri kavanoza at
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {losers.map((idea) => (
                <div key={idea.id} className="flex items-center justify-between gap-3">
                  <span className="truncate" style={{ color: "var(--text)" }}>
                    {idea.text}
                  </span>
                  {returned.has(idea.id) ? (
                    <span className="text-[0.8rem]" style={{ color: "#6FD9B4" }}>
                      ✓ kavanozda
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void sendToJar(idea.id)}
                      className="rounded-full px-3 py-1.5 text-[0.8rem] font-semibold"
                      style={{ background: "rgba(217,119,87,0.2)", color: "#D97757" }}
                      data-testid={`return-idea-${idea.id}`}
                    >
                      Kavanoza at
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      {/* özet şeridi */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl px-5 py-4" style={{ background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.08)", boxShadow: "var(--card-shadow)" }}>
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

      {isOwner && <InvitePanel basketId={b.id} />}

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
          <IdeaInput accent={accent} onAdd={async (text, tag) => { await addIdea({ basket_id: b.id, text, tag, created_by: voter, tenant_id: b.tenant_id }); }} />
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
