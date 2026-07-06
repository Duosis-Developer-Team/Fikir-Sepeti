"use client";

import Link from "next/link";
import { useMemo } from "react";
import { motion } from "motion/react";
import { useRealtimeVotes } from "@/lib/useRealtimeVotes";
import {
  addIdea,
  resolveBasket,
  setBasketPhase,
  setFinalists,
} from "@/lib/db";
import { IdeaInput } from "@/components/social/IdeaInput";
import { LiveVotePanel } from "@/components/shared/LiveVotePanel";
import { ResultScreen } from "@/components/shared/ResultScreen";
import { StatusPill } from "@/components/shared/StatusPill";
import { PhaseBar } from "./PhaseBar";
import { DemoCard } from "./DemoCard";
import { SquadPicker } from "./SquadPicker";
import type { Basket, Idea } from "@/lib/types";

const FINALIST_COUNT = 3;

export function BuildBasket({ basket: initial, voter }: { basket: Basket; voter: string }) {
  const { basket, ideas, myVotes, connected, vote } = useRealtimeVotes(initial.id, voter);
  const b = basket ?? initial;
  const finalists = useMemo(() => ideas.filter((i) => i.is_finalist), [ideas]);

  const winner = useMemo<Idea | null>(() => {
    if (b.winner_idea_id) return ideas.find((i) => i.id === b.winner_idea_id) ?? null;
    if (finalists.length === 0) return null;
    return [...finalists].sort((a, c) => c.vote_count - a.vote_count)[0] ?? null;
  }, [ideas, finalists, b.winner_idea_id]);

  const lockFinalists = async () => {
    const top = [...ideas]
      .sort((a, c) => c.vote_count - a.vote_count)
      .slice(0, FINALIST_COUNT)
      .map((i) => i.id);
    await setFinalists(b.id, top);
    await setBasketPhase(b.id, "demos");
  };

  const advance = (to: Parameters<typeof setBasketPhase>[1]) => setBasketPhase(b.id, to);

  const Header = (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[var(--text-muted)]">{ideas.length} fikir</span>
        <StatusPill live={connected} />
      </div>
      <PhaseBar phase={b.phase} />
    </div>
  );

  // ---- RESOLVED ----
  if (b.status === "resolved") {
    return (
      <div className="mx-auto max-w-md space-y-5">
        {Header}
        <ResultScreen winner={winner} accent="build" fireConfetti={false} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      {Header}

      {/* ---- FAZ: FİKİR ---- */}
      {b.phase === "ideas" && (
        <div className="space-y-3">
          <IdeaInput
            accent="build"
            withTag
            placeholder="Ne yapalım? (proje fikri)"
            onAdd={async (text, tag) => {
              await addIdea({ basket_id: b.id, text, tag, created_by: voter });
            }}
          />
          <div className="space-y-2">
            {ideas.map((i) => (
              <motion.div
                key={i.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 text-sm"
              >
                <span className="flex-1">{i.text}</span>
                {i.tag && (
                  <span
                    className="rounded-full px-2 py-0.5 text-xs"
                    style={{ background: "var(--accent-build-soft)", color: "var(--accent-build)" }}
                  >
                    {i.tag}
                  </span>
                )}
              </motion.div>
            ))}
          </div>
          {ideas.length > 0 && (
            <button
              onClick={() => advance("finalists")}
              className="w-full rounded-lg py-3 text-sm font-medium text-white"
              style={{ background: "var(--accent-build)" }}
            >
              Finalist oylamasına geç
            </button>
          )}
        </div>
      )}

      {/* ---- FAZ: FİNALİST OYLAMASI ---- */}
      {b.phase === "finalists" && (
        <div className="space-y-3">
          <p className="text-sm text-[var(--text-muted)]">
            En çok oy alan {FINALIST_COUNT} fikir finalist olur.
          </p>
          <LiveVotePanel
            ideas={ideas}
            phase="finalists"
            myVoteId={myVotes["finalists"]}
            onVote={vote}
            accent="build"
          />
          <button
            onClick={lockFinalists}
            className="w-full rounded-lg border py-2.5 text-sm font-medium"
            style={{ borderColor: "var(--accent-build)", color: "var(--accent-build)" }}
          >
            Finalistleri kilitle
          </button>
        </div>
      )}

      {/* ---- FAZ: DEMO HAZIRLIĞI ---- */}
      {b.phase === "demos" && (
        <div className="space-y-3">
          <p className="text-sm text-[var(--text-muted)]">Her finaliste demo bilgisi gir.</p>
          {finalists.map((i) => (
            <DemoCard key={i.id} idea={i} />
          ))}
          <button
            onClick={() => advance("voting")}
            className="w-full rounded-lg py-3 text-sm font-medium text-white"
            style={{ background: "var(--accent-build)" }}
          >
            Sunuma hazır
          </button>
        </div>
      )}

      {/* ---- FAZ: CANLI OYLAMA (telefon) ---- */}
      {b.phase === "voting" && (
        <div className="space-y-3">
          <Link
            href={`/basket/${b.id}/present`}
            target="_blank"
            className="flex items-center justify-center rounded-lg py-2.5 text-sm font-medium text-white"
            style={{ background: "var(--accent-build)" }}
          >
            Presenter modunu aç ↗
          </Link>
          <p className="text-center text-sm text-[var(--text-muted)]">
            Sahnedeki demoya telefonundan oy ver.
          </p>
          <LiveVotePanel
            ideas={finalists}
            phase="voting"
            myVoteId={myVotes["voting"]}
            onVote={vote}
            accent="build"
          />
          <button
            onClick={() => advance("squad")}
            className="w-full rounded-lg border py-2.5 text-sm font-medium"
            style={{ borderColor: "var(--accent-build)", color: "var(--accent-build)" }}
          >
            Oylamayı bitir → squad
          </button>
        </div>
      )}

      {/* ---- FAZ: SQUAD ---- */}
      {b.phase === "squad" && (
        <SquadPicker
          basketId={b.id}
          winner={winner}
          voter={voter}
          onResolve={() => winner && resolveBasket(b.id, winner.id)}
        />
      )}
    </div>
  );
}
