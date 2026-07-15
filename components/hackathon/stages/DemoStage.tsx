"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { upsertScore, voteTeam } from "@/lib/hackathon";
import { DEFAULT_RUBRIC, type RubricCategory } from "@/lib/scoring";
import { Scoreboard } from "../Scoreboard";
import type { StageContext } from "../contract";
import { GOLD, GOLD_SOFT, dim } from "../contract";
import { Avatar, StageHeadline } from "../ui";

export function DemoStage({ data, user, config, refresh }: StageContext) {
  const { basket, teams, members, teamVotes, participants, ideas, scores } = data;
  const selected = ideas.find((i) => i.id === basket.selected_idea_id) ?? null;
  const mode = config.scoringMode ?? "simple";
  const rubric: RubricCategory[] = config.rubric?.length ? config.rubric : DEFAULT_RUBRIC;
  const [activeTeam, setActiveTeam] = useState<string | null>(teams[0]?.id ?? null);

  const isJury = false; // jury flag set by role assignment in future; weight tested via seeded is_jury rows

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
    await voteTeam(basket.id, teamId, user.email, basket.tenant_id);
    refresh();
  };

  const myStars = (teamId: string, key: string) =>
    scores.find(
      (s) =>
        s.team_id === teamId &&
        s.voter === user.email &&
        s.category_key === key
    )?.stars ?? 0;

  const setStars = async (teamId: string, key: string, stars: number) => {
    await upsertScore({
      basket_id: basket.id,
      tenant_id: basket.tenant_id,
      team_id: teamId,
      voter: user.email,
      category_key: key,
      stars,
      is_jury: isJury,
    });
    refresh();
  };

  if (mode === "rubric") {
    const team = teams.find((t) => t.id === activeTeam) ?? teams[0];
    return (
      <div className="mx-auto max-w-[1100px]">
        <StageHeadline
          pre="Rubrik"
          accent="puanla"
          sub="Her takımı kategorilerde 1–5 yıldızla değerlendir."
        />
        <div className="mb-5 flex flex-wrap gap-2">
          {teams.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTeam(t.id)}
              className="rounded-full px-4 py-2 text-[0.9rem] font-semibold"
              style={{
                background: t.id === team?.id ? GOLD : "var(--card)",
                color: t.id === team?.id ? "#17150F" : "var(--text)",
                border: "1px solid rgba(var(--border-rgb),0.08)",
              }}
            >
              {t.name}
            </button>
          ))}
        </div>

        {team && (
          <div
            className="rounded-[22px] p-6"
            style={{ background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.09)" }}
            data-testid="rubric-score-panel"
          >
            <p className="font-display text-[1.4rem] font-bold" style={{ color: GOLD }}>{team.name}</p>
            <div className="mt-4 flex flex-col gap-4">
              {rubric.map((cat) => {
                const current = myStars(team.id, cat.key);
                return (
                  <div key={cat.key} className="flex flex-wrap items-center justify-between gap-3">
                    <span style={{ color: "var(--text)" }}>{cat.label}</span>
                    <div className="flex gap-1.5" data-testid={`stars-${cat.key}`}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => void setStars(team.id, cat.key, n)}
                          className="grid h-9 w-9 place-items-center rounded-full text-[1.05rem] font-bold transition"
                          style={{
                            background: current >= n ? GOLD : "var(--surface-2)",
                            color: current >= n ? "#17150F" : dim(0.5),
                          }}
                          aria-label={`${cat.label} ${n} yıldız`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Scoreboard
          teams={teams}
          scores={scores}
          rubric={rubric}
          juryEnabled={config.juryEnabled}
          juryWeight={config.juryWeight}
        />
      </div>
    );
  }

  // ── simple mode (default) ──
  return (
    <div className="mx-auto max-w-[1100px]">
      <StageHeadline pre="En iyi yapımı" accent="seç" sub={selected ? selected.text : "Bir takıma dokun — oyunu ver."} />
      <div className="mb-4 flex items-baseline justify-end px-1">
        <span className="text-[0.95rem]" style={{ color: dim(0.5) }}>
          <span className="font-display font-bold" style={{ color: "var(--text)" }}>{teamVotes.length}</span> oy verildi
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <AnimatePresence initial={false}>
          {sorted.map((t, rank) => {
            const n = votesOf(t.id);
            const pct = (n / max) * 100;
            const teamIdea =
              ideas.find((i) => i.id === t.idea_id)?.text ??
              (selected ? selected.text : null);
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
                style={{ background: "rgba(var(--border-rgb),0.035)", border: `1px solid ${mine ? GOLD : lead ? "rgba(231,169,63,0.5)" : "rgba(var(--border-rgb),0.08)"}`, boxShadow: lead ? "0 14px 50px -26px rgba(231,169,63,0.6)" : "none" }}
              >
                <motion.div className="absolute inset-y-0 left-0" initial={false} animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 140, damping: 26 }} style={{ background: lead ? "rgba(231,169,63,0.18)" : "rgba(var(--border-rgb),0.05)" }} />
                <div className="relative flex items-center gap-5 px-6 py-4">
                  <span className="tnum font-display w-8 shrink-0 text-[1.6rem] font-bold" style={{ color: lead ? GOLD_SOFT : dim(0.3) }}>{rank + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-[1.5rem] font-bold leading-tight" style={{ color: "var(--text)" }}>{t.name}</p>
                    {teamIdea && (
                      <p className="mt-0.5 truncate text-[0.85rem]" style={{ color: dim(0.5) }}>
                        {teamIdea}
                        {t.angle ? ` · ${t.angle}` : ""}
                      </p>
                    )}
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
