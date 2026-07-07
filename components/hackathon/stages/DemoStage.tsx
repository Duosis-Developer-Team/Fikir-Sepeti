"use client";

import { AnimatePresence, motion } from "motion/react";
import { voteTeam } from "@/lib/hackathon";
import type { StageContext } from "../contract";
import { GOLD, GOLD_SOFT, dim } from "../contract";
import { Avatar, StageHeadline } from "../ui";

export function DemoStage({ data, user, refresh }: StageContext) {
  const { basket, teams, members, teamVotes, participants, ideas } = data;
  const selected = ideas.find((i) => i.id === basket.selected_idea_id) ?? null;

  const votesOf = (teamId: string) => teamVotes.filter((v) => v.team_id === teamId).length;
  const sorted = [...teams].sort((a, b) => votesOf(b.id) - votesOf(a.id));
  const max = Math.max(1, ...teams.map((t) => votesOf(t.id)));
  const leader = Math.max(0, ...teams.map((t) => votesOf(t.id)));
  const myVote = teamVotes.find((v) => v.voter === user.email);
  const nameOf = (uid: string) => {
    const p = participants.find((x) => x.user_id === uid);
    return p?.display_name || p?.email || uid;
  };
  const vote = async (teamId: string) => {
    await voteTeam(basket.id, teamId, user.email);
    refresh();
  };

  return (
    <div className="mx-auto max-w-[1100px]">
      <StageHeadline pre="En iyi yapımı" accent="seç" sub={selected ? selected.text : "Bir takıma dokun — oyunu ver."} />
      <div className="mb-4 flex items-baseline justify-end px-1">
        <span className="text-[0.95rem]" style={{ color: dim(0.5) }}>
          <span className="font-display font-bold" style={{ color: "#EDEDED" }}>{teamVotes.length}</span> oy verildi
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <AnimatePresence initial={false}>
          {sorted.map((t, rank) => {
            const n = votesOf(t.id);
            const pct = (n / max) * 100;
            const lead = n === leader && leader > 0;
            const mine = myVote?.team_id === t.id;
            const mem = members.filter((m) => m.team_id === t.id);
            return (
              <motion.button
                key={t.id}
                layout
                onClick={() => vote(t.id)}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="relative overflow-hidden rounded-[20px] text-left"
                style={{ background: "rgba(255,255,255,0.035)", border: `1px solid ${mine ? GOLD : lead ? "rgba(231,169,63,0.5)" : "rgba(255,255,255,0.08)"}`, boxShadow: lead ? "0 14px 50px -26px rgba(231,169,63,0.6)" : "none" }}
              >
                <motion.div className="absolute inset-y-0 left-0" initial={false} animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 140, damping: 26 }} style={{ background: lead ? "rgba(231,169,63,0.18)" : "rgba(255,255,255,0.05)" }} />
                <div className="relative flex items-center gap-5 px-6 py-4">
                  <span className="tnum font-display w-8 shrink-0 text-[1.6rem] font-bold" style={{ color: lead ? GOLD_SOFT : dim(0.3) }}>{rank + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-[1.5rem] font-bold leading-tight" style={{ color: "#EDEDED" }}>{t.name}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {mem.map((m) => <Avatar key={m.id} name={nameOf(m.user_id)} size={26} />)}
                    </div>
                  </div>
                  {mine && <span className="shrink-0 text-[0.8rem] font-semibold" style={{ color: GOLD }}>senin oyun ✓</span>}
                  <span className="tnum font-display shrink-0 text-[2.4rem] font-extrabold" style={{ color: lead ? GOLD : dim(0.85) }}>{n}</span>
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
        {!teams.length && <p className="py-10 text-center text-[0.95rem]" style={{ color: dim(0.4) }}>Takım yok.</p>}
      </div>

      <p className="mt-5 text-center text-[0.85rem]" style={{ color: dim(0.4) }}>Bir takıma dokun — oyunu ver. İstediğin zaman değiştirebilirsin.</p>
    </div>
  );
}
