"use client";

import { useMemo } from "react";
import { useRealtimeVotes } from "@/lib/useRealtimeVotes";
import { addIdea, resolveBasket } from "@/lib/db";
import { LiveVotePanel } from "@/components/shared/LiveVotePanel";
import { ResultScreen } from "@/components/shared/ResultScreen";
import { StatusPill } from "@/components/shared/StatusPill";
import { IdeaInput } from "./IdeaInput";
import { RaffleReveal } from "./RaffleReveal";
import type { Basket } from "@/lib/types";

export function SocialBasket({ basket: initial, voter }: { basket: Basket; voter: string }) {
  const { basket, ideas, myVotes, connected, vote } = useRealtimeVotes(initial.id, voter);
  const b = basket ?? initial;

  const winner = useMemo(
    () => ideas.find((i) => i.id === b.winner_idea_id) ?? null,
    [ideas, b.winner_idea_id]
  );

  const resolveByVote = async () => {
    if (ideas.length === 0) return;
    const top = [...ideas].sort((a, c) => c.vote_count - a.vote_count)[0];
    await resolveBasket(b.id, top.id);
  };

  if (b.status === "resolved") {
    return (
      <div className="mx-auto max-w-md">
        <ResultScreen winner={winner} accent="social" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[var(--text-muted)]">
          {b.resolve_method === "raffle" ? "Kura" : "Oylama"} · {ideas.length} fikir
        </span>
        <StatusPill live={connected} />
      </div>

      <IdeaInput
        accent="social"
        onAdd={async (text, tag) => {
          await addIdea({ basket_id: b.id, text, tag, created_by: voter });
        }}
      />

      {b.resolve_method === "raffle" ? (
        <RaffleReveal ideas={ideas} onWinner={(w) => resolveBasket(b.id, w.id)} />
      ) : (
        <>
          <LiveVotePanel
            ideas={ideas}
            phase="ideas"
            myVoteId={myVotes["ideas"]}
            onVote={vote}
            accent="social"
          />
          {ideas.length > 0 && (
            <button
              onClick={resolveByVote}
              className="w-full rounded-lg border border-[var(--accent-social)] py-2.5 text-sm font-medium transition"
              style={{ color: "var(--accent-social)" }}
            >
              Sonucu çek
            </button>
          )}
        </>
      )}
    </div>
  );
}
