"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { markDone, listFeedback } from "@/lib/hackathon";
import { markPoolWinner, returnIdeaToPool } from "@/lib/pool";
import { groupFeedbackByTeam } from "@/lib/feedback-groups";
import { DEFAULT_RUBRIC } from "@/lib/scoring";
import { supabase } from "@/lib/supabase";
import type { Feedback } from "@/lib/types";
import type { StageContext } from "../contract";
import { GOLD, GOLD_SOFT, dim } from "../contract";
import { Card, GoldButton, Avatar, initials } from "../ui";
import { Scoreboard } from "../Scoreboard";

export function ProductionStage({ data, config, user, isAdmin }: StageContext) {
  const { basket, teams, members, teamVotes, ideas, participants, scores } = data;
  const selected = ideas.find((i) => i.id === basket.selected_idea_id) ?? null;
  const votesOf = (id: string) => teamVotes.filter((v) => v.team_id === id).length;
  const winner = [...teams].sort((a, b) => votesOf(b.id) - votesOf(a.id))[0] ?? null;
  const winnerMembers = winner ? members.filter((m) => m.team_id === winner.id) : [];
  const done = basket.status === "resolved" || basket.phase === "done";
  const [returned, setReturned] = useState<Set<string>>(new Set());
  const [productionNote, setProductionNote] = useState(basket.production_note ?? "");
  const [projectLink, setProjectLink] = useState(basket.project_link ?? "");
  const [confirmSkipMeta, setConfirmSkipMeta] = useState(false);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const nameOf = (uid: string) => {
    const p = participants.find((x) => x.user_id === uid);
    return p?.display_name || p?.email || uid;
  };

  const loadFeedback = useCallback(() => {
    listFeedback(basket.id).then(setFeedback);
  }, [basket.id]);

  useEffect(() => {
    loadFeedback();
    const ch = supabase
      .channel(`fb-prod:${basket.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "feedback", filter: `basket_id=eq.${basket.id}` },
        () => loadFeedback()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [basket.id, loadFeedback]);

  const teamNames = useMemo(() => {
    const m: Record<string, string> = {};
    for (const t of teams) m[t.id] = t.name;
    return m;
  }, [teams]);
  const feedbackGroups = useMemo(() => groupFeedbackByTeam(feedback, teamNames), [feedback, teamNames]);

  const metaMissing = productionNote.trim() === "" && projectLink.trim() === "";

  const finalize = async () => {
    if (metaMissing && !confirmSkipMeta) {
      setConfirmSkipMeta(true);
      return;
    }
    await markDone(basket.id, selected?.id ?? null, {
      production_note: productionNote.trim() || null,
      project_link: projectLink.trim() || null,
    });
    const poolId = basket.config?.repoPoolIdeaId;
    if (poolId && winner) {
      await markPoolWinner({
        pool_idea_id: poolId,
        winner_label: winner.name,
        tenant_id: basket.tenant_id,
        actor: user.email,
      });
    }
    // FS-08: kazanmayan fikirler otomatik sepete döner — organizatörün
    // her birini elle "sepete at" ile taşımasına gerek kalmaz.
    if (ideas.length > 1) {
      const winnerId = basket.winner_idea_id ?? basket.selected_idea_id;
      const losers = ideas.filter((i) => i.id !== winnerId);
      for (const idea of losers) {
        await returnIdeaToPool({
          idea_id: idea.id,
          basket_id: basket.id,
          created_by: user.email,
          tenant_id: basket.tenant_id,
        });
      }
    }
    // üretime alındı → ana sayfaya dön (tam reload)
    window.location.assign("/");
  };

  const sendToJar = async (ideaId: string) => {
    const row = await returnIdeaToPool({
      idea_id: ideaId,
      basket_id: basket.id,
      created_by: user.email,
      tenant_id: basket.tenant_id,
    });
    if (row) setReturned((prev) => new Set(prev).add(ideaId));
  };

  return (
    <div className="mx-auto max-w-[640px]">
      <Card className="text-center">
        <span className="text-[0.75rem] font-semibold uppercase tracking-[0.28em]" style={{ color: GOLD }}>
          {done ? "Üretime alındı" : "Sonuçlar"}
        </span>

        {winner ? (
          <div className="relative">
            {/* bloom — kutlama */}
            <motion.span
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[80px]"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 0.45, scale: 1 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              style={{ background: "rgba(231,169,63,0.45)" }}
            />
            <motion.h2
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.1 }}
              className="font-display relative mt-4 text-[clamp(2.2rem,5.5vw,3.6rem)] font-extrabold leading-[1.02]"
              style={{ color: GOLD, textShadow: "0 20px 80px rgba(231,169,63,0.35)" }}
            >
              🏆 {winner.name}
            </motion.h2>
            <p className="relative mt-2 tnum text-[1.05rem]" style={{ color: GOLD_SOFT }}>{votesOf(winner.id)} oy ile</p>
            <div className="relative mt-5 flex flex-wrap justify-center gap-1.5">
              {winnerMembers.map((m) => (
                <span key={m.id} className="inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-[0.9rem]" style={{ background: "rgba(var(--border-rgb),0.05)", color: "var(--text)" }}>
                  <Avatar name={nameOf(m.user_id)} size={26} />
                  {nameOf(m.user_id)}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <h2 className="font-display mt-4 text-[1.6rem] font-bold" style={{ color: "var(--text)" }}>Kazanan yok</h2>
        )}

        {teams.length > 0 && (
          <div className="mt-6 flex flex-col gap-2 text-left">
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.22em]" style={{ color: dim(0.45) }}>Sıralama</span>
            {[...teams].sort((a, b) => votesOf(b.id) - votesOf(a.id)).map((t, rank) => {
              const mem = members.filter((m) => m.team_id === t.id);
              const win = winner?.id === t.id;
              return (
                <div key={t.id} className="flex items-center gap-3 rounded-xl px-4 py-2.5" style={{ background: win ? "rgba(231,169,63,0.1)" : "var(--surface-2)", border: `1px solid ${win ? GOLD : "rgba(var(--border-rgb),0.07)"}` }}>
                  <span className="tnum font-display w-5 font-bold" style={{ color: win ? GOLD_SOFT : dim(0.4) }}>{rank + 1}</span>
                  <span className="flex-1 truncate font-semibold" style={{ color: "var(--text)" }}>{t.name}</span>
                  <div className="flex gap-1">{mem.map((m) => <Avatar key={m.id} name={nameOf(m.user_id)} size={22} />)}</div>
                  <span className="tnum font-display text-[1.1rem] font-bold" style={{ color: win ? GOLD : dim(0.7) }}>{votesOf(t.id)}</span>
                </div>
              );
            })}
          </div>
        )}

        {selected && (
          <p className="mt-5 text-[0.95rem]" style={{ color: dim(0.55) }}>
            Fikir: <span style={{ color: "var(--text)" }}>{selected.text}</span>
          </p>
        )}

        {done && ideas.length > 1 && (
          <div className="mt-6 text-left" data-testid="return-to-pool">
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.22em]" style={{ color: dim(0.45) }}>
              Kaybedenleri sepete at
            </span>
            <div className="mt-2 flex flex-col gap-2">
              {ideas
                .filter((i) => i.id !== (basket.winner_idea_id ?? basket.selected_idea_id))
                .map((idea) => (
                  <div
                    key={idea.id}
                    className="flex items-center justify-between gap-3 rounded-xl px-4 py-2.5"
                    style={{ background: "var(--surface-2)" }}
                  >
                    <span className="truncate text-[0.95rem]" style={{ color: "var(--text)" }}>
                      {idea.text}
                    </span>
                    {returned.has(idea.id) ? (
                      <span className="text-[0.8rem]" style={{ color: "#6FD9B4" }}>
                        ✓ sepetinde
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void sendToJar(idea.id)}
                        className="shrink-0 rounded-full px-3 py-1.5 text-[0.78rem] font-semibold"
                        style={{ background: "rgba(217,119,87,0.2)", color: "#D97757" }}
                        data-testid={`return-idea-${idea.id}`}
                      >
                        Sepete at
                      </button>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        {!done && isAdmin && (
          <div className="mt-6 text-left" data-testid="production-meta">
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.22em]" style={{ color: dim(0.45) }}>
              Üretim notu / proje linki
            </span>
            <input
              value={productionNote}
              onChange={(e) => { setProductionNote(e.target.value); setConfirmSkipMeta(false); }}
              placeholder="Ne yapıldı, kim yaptı"
              className="mt-2 w-full rounded-xl px-3 py-2.5 text-[0.95rem]"
              style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid rgba(var(--border-rgb),0.1)" }}
              data-testid="production-note"
            />
            <input
              value={projectLink}
              onChange={(e) => { setProjectLink(e.target.value); setConfirmSkipMeta(false); }}
              placeholder="Proje linki (repo/deploy/tasarım)"
              className="mt-2 w-full rounded-xl px-3 py-2.5 text-[0.95rem]"
              style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid rgba(var(--border-rgb),0.1)" }}
              data-testid="production-link"
            />
            {confirmSkipMeta && (
              <p className="mt-2 text-[0.85rem]" style={{ color: "#E3A857" }} data-testid="production-meta-warning">
                Not/link girmeden bitirirsen bu iş takip için görünmez kalır. Devam etmek için tekrar bas.
              </p>
            )}
          </div>
        )}

        {done && (basket.production_note || basket.project_link) && (
          <p className="mt-5 text-[0.92rem]" style={{ color: dim(0.6) }} data-testid="production-summary">
            {basket.production_note}
            {basket.project_link && (
              <>
                {basket.production_note ? " · " : ""}
                <a href={basket.project_link} target="_blank" rel="noreferrer" className="underline" style={{ color: GOLD_SOFT }}>
                  proje linki
                </a>
              </>
            )}
          </p>
        )}

        <div className="mt-7">
          {done ? (
            <span className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[0.95rem] font-semibold" style={{ background: "rgba(51,194,147,0.14)", color: "#6FD9B4" }}>✓ Üretime alındı</span>
          ) : isAdmin ? (
            <GoldButton onClick={finalize}>
              {confirmSkipMeta ? "Yine de bitir →" : "Üretime al · kapat"}
            </GoldButton>
          ) : (
            <p className="text-[0.9rem]" style={{ color: dim(0.5) }}>Admin sonuçlandıracak.</p>
          )}
        </div>
      </Card>

      {config.scoringMode === "rubric" && teams.length > 0 && (
        <Scoreboard
          teams={teams}
          scores={scores}
          rubric={config.rubric?.length ? config.rubric : DEFAULT_RUBRIC}
          juryEnabled={config.juryEnabled}
          juryWeight={config.juryWeight}
        />
      )}

      {feedback.length > 0 && (
        <div className="mt-8 text-left" data-testid="production-feedback">
          <span className="text-[0.7rem] font-semibold uppercase tracking-[0.22em]" style={{ color: dim(0.45) }}>
            Feedback
          </span>
          <div className="mt-3 flex flex-col gap-4">
            {feedbackGroups.map((g) => (
              <div key={g.key}>
                <h4 className="mb-1.5 text-[0.68rem] font-semibold uppercase tracking-wider" style={{ color: dim(0.4) }}>
                  {g.label}
                </h4>
                <div className="flex flex-col gap-2">
                  {g.items.map((f) => (
                    <div
                      key={f.id}
                      className="flex gap-2.5 rounded-xl px-3.5 py-2.5"
                      style={{ background: "var(--surface-2)" }}
                    >
                      <span
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[0.72rem] font-bold"
                        style={{ background: "var(--card)", color: "var(--text)" }}
                      >
                        {initials(f.author_name || f.author_id || "?")}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[0.75rem]" style={{ color: dim(0.45) }}>{f.author_name || f.author_id}</p>
                        <p className="text-[0.92rem]" style={{ color: "var(--text)" }}>{f.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
