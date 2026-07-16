"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { supabase } from "@/lib/supabase";
import { setBasketPhase } from "@/lib/db";
import { joinLobbyGated, listParticipants, listScores, listTeamMembers, listTeamVotes, listTeams, startHackathonTimer } from "@/lib/hackathon";
import { decideLobbyJoin } from "@/lib/lobby";
import { useSession } from "@/components/AuthGate";
import type { Basket, Idea, Score } from "@/lib/types";
import type { HackData, StageContext, StageDef, StagePhase } from "./contract";
import { PHASE_ORDER, PHASE_LABEL, GOLD, GOLD_SOFT, dim, configReady } from "./contract";
import { LobbyStage } from "./stages/LobbyStage";
import { IdeaStage } from "./stages/IdeaStage";
import { TeamStage } from "./stages/TeamStage";
import { HackathonStage } from "./stages/HackathonStage";
import { DemoStage } from "./stages/DemoStage";
import { FeedbackStage } from "./stages/FeedbackStage";
import { ProductionStage } from "./stages/ProductionStage";

// ── modül registry — orchestrator sadece bu haritayı bilir ──
const STAGES: Record<StagePhase, StageDef> = {
  lobby: { key: "lobby", Comp: LobbyStage, canAdvance: (c) => configReady(c.config) && c.data.participants.length >= 1 },
  idea: { key: "idea", Comp: IdeaStage, canAdvance: (c) => !!c.data.basket.selected_idea_id },
  team: { key: "team", Comp: TeamStage, canAdvance: (c) => c.data.teams.length > 0 },
  hackathon: { key: "hackathon", Comp: HackathonStage, canAdvance: () => true },
  demo: { key: "demo", Comp: DemoStage, canAdvance: () => true },
  feedback: { key: "feedback", Comp: FeedbackStage, canAdvance: () => true },
  production: { key: "production", Comp: ProductionStage, canAdvance: () => false },
  done: { key: "done", Comp: ProductionStage, canAdvance: () => false },
};

export function HackathonRunner({ basketId }: { basketId: string }) {
  const { user } = useSession();
  const [data, setData] = useState<HackData | null>(null);
  const joined = useRef(false);

  const [joinBlocked, setJoinBlocked] = useState(false);
  const [joinPending, setJoinPending] = useState(false);

  const load = useCallback(async () => {
    const [basketRes, ideasRes, participants, teams, members, teamVotes, scores] = await Promise.all([
      supabase.from("baskets").select("*").eq("id", basketId).single(),
      supabase.from("ideas").select("*").eq("basket_id", basketId).order("vote_count", { ascending: false }),
      listParticipants(basketId),
      listTeams(basketId),
      listTeamMembers(basketId),
      listTeamVotes(basketId),
      listScores(basketId),
    ]);
    const basket = basketRes.data as Basket | null;
    if (!basket) return;
    setData({
      basket,
      ideas: (ideasRes.data as Idea[]) ?? [],
      participants,
      teams,
      members,
      teamVotes,
      scores: scores as Score[],
    });
  }, [basketId]);

  useEffect(() => {
    void load();
    const ch = supabase
      .channel(`hack:${basketId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "baskets", filter: `id=eq.${basketId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "ideas", filter: `basket_id=eq.${basketId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "hackathon_participants", filter: `basket_id=eq.${basketId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "teams", filter: `basket_id=eq.${basketId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "team_members", filter: `basket_id=eq.${basketId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "team_votes", filter: `basket_id=eq.${basketId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "scores", filter: `basket_id=eq.${basketId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [basketId, load]);

  // lobiye katıl (bir kez) — gated API
  useEffect(() => {
    if (!user || !data || joined.current) return;
    joined.current = true;
    const isOwner = data.basket.created_by === user.email;
    const already = data.participants.some((p) => p.user_id === user.email);
    if (already) {
      const me = data.participants.find((p) => p.user_id === user.email);
      if (me && me.approved === false) setJoinPending(true);
      return;
    }
    const preview = decideLobbyJoin({
      basket: data.basket,
      isOwner,
    });
    if (!preview.ok) {
      setJoinBlocked(true);
      return;
    }
    void joinLobbyGated({
      basket_id: basketId,
      email: user.email,
      tenant_id: data.basket.tenant_id,
      display_name: user.name,
    }).then((r) => {
      if (!r.ok) {
        setJoinBlocked(true);
        return;
      }
      if (r.approved === false) setJoinPending(true);
      void load();
    });
  }, [user, data, basketId, load]);

  if (!user || !data) {
    return <div className="mx-auto mt-20 h-40 max-w-[760px] animate-pulse rounded-[22px]" style={{ background: "var(--card)" }} />;
  }

  if (joinBlocked) {
    return (
      <div className="mx-auto mt-24 max-w-[520px] px-6 text-center" data-testid="lobby-locked">
        <p className="font-display text-[1.6rem] font-bold" style={{ color: "var(--text)" }}>
          Lobi kilitli
        </p>
        <p className="mt-2 text-[0.95rem]" style={{ color: dim(0.55) }}>
          Bu hackathon başlamış veya katılım kapalı. Geç katılım açıksa admin ayarından girebilirsin.
        </p>
      </div>
    );
  }

  if (joinPending) {
    return (
      <div className="mx-auto mt-24 max-w-[520px] px-6 text-center" data-testid="lobby-pending">
        <p className="font-display text-[1.6rem] font-bold" style={{ color: "var(--text)" }}>
          Onay bekleniyor
        </p>
        <p className="mt-2 text-[0.95rem]" style={{ color: dim(0.55) }}>
          Admin seni onaylayınca lobiye gireceksin.
        </p>
      </div>
    );
  }

  const phase = (PHASE_ORDER.includes(data.basket.phase as StagePhase) ? data.basket.phase : "lobby") as StagePhase;
  const isAdmin = data.basket.created_by === user.email;
  const ctx: StageContext = { data, config: data.basket.config ?? {}, user, isAdmin, refresh: load };
  const def = STAGES[phase];
  const idx = PHASE_ORDER.indexOf(phase);
  const nextPhase = PHASE_ORDER[idx + 1];
  const prevPhase = PHASE_ORDER[idx - 1];
  const canAdvance = phase !== "done" && phase !== "production" && def.canAdvance(ctx);

  // faza gir (hackathon'a girerken geri sayımı başlat)
  const enterPhase = async (p: StagePhase) => {
    if (p === phase) return;
    if (p === "hackathon" && !data.basket.hackathon_ends_at) await startHackathonTimer(basketId, ctx.config);
    await setBasketPhase(basketId, p);
    load();
  };
  const advance = () => { if (nextPhase) void enterPhase(nextPhase); };
  const goBack = () => { if (prevPhase) void setBasketPhase(basketId, prevPhase).then(load); };

  return (
    <div className="pb-40">
      {/* stepper — admin herhangi bir faza atlayabilir */}
      <Stepper phase={phase} isAdmin={isAdmin} onJump={enterPhase} />

      {/* aktif modül — fazlar arası orkestre giriş */}
      <motion.div
        key={phase}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mt-10"
      >
        <def.Comp {...ctx} />
      </motion.div>

      {/* admin faz çubuğu — geri + ileri (lobi ve hackathon kendi navigasyonunu yönetir) */}
      {isAdmin && phase !== "done" && phase !== "lobby" && phase !== "hackathon" && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-5">
          <div className="flex items-center gap-3 rounded-full px-3 py-2.5" style={{ background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.1)", boxShadow: "0 20px 50px -24px rgba(0,0,0,0.7)" }}>
            <button
              onClick={goBack}
              disabled={!prevPhase}
              className="rounded-full border px-5 py-2.5 text-[0.9rem] transition hover:bg-[rgba(var(--border-rgb),0.08)] disabled:opacity-25"
              style={{ borderColor: "rgba(var(--border-rgb),0.2)", color: dim(0.85) }}
            >
              ← {prevPhase ? PHASE_LABEL[prevPhase] : "Geri"}
            </button>
            {phase !== "production" && (
              <>
                <span className="px-1 text-[0.82rem]" style={{ color: dim(0.45) }}>{canAdvance ? "Hazır" : "Bu aşamayı tamamla"}</span>
                <button
                  onClick={advance}
                  disabled={!canAdvance || !nextPhase}
                  className="rounded-full px-6 py-2.5 text-[0.9rem] font-semibold transition hover:opacity-90 disabled:opacity-30"
                  style={{ background: GOLD, color: "#17150F" }}
                >
                  {nextPhase ? `Sonraki: ${PHASE_LABEL[nextPhase]} →` : "Bitti"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stepper({ phase, isAdmin, onJump }: { phase: StagePhase; isAdmin: boolean; onJump: (p: StagePhase) => void }) {
  const steps = PHASE_ORDER.filter((p) => p !== "done");
  const active = Math.min(PHASE_ORDER.indexOf(phase), steps.length - 1);
  return (
    <div className="mx-auto max-w-[1080px] px-2">
      <div
        className="flex items-center gap-1"
        style={{ background: "rgba(var(--border-rgb),0.05)", border: "1px solid rgba(var(--border-rgb),0.08)", borderRadius: 999, padding: 5 }}
      >
        {steps.map((p, i) => {
          const done = i < active;
          const on = i === active;
          const st = on
            ? { background: GOLD, color: "var(--bg)", boxShadow: `0 6px 18px -6px ${GOLD}` }
            : done
              ? { background: "rgba(231,169,63,0.13)", color: GOLD_SOFT }
              : { background: "transparent", color: dim(0.42) };
          const cls = "flex-1 whitespace-nowrap rounded-full px-3 py-2.5 text-center text-[0.85rem] font-semibold transition-colors";
          return isAdmin ? (
            <motion.button key={p} whileTap={{ scale: 0.96 }} onClick={() => onJump(p)} className={cls} style={st}>
              {PHASE_LABEL[p]}
            </motion.button>
          ) : (
            <div key={p} className={cls} style={st}>{PHASE_LABEL[p]}</div>
          );
        })}
      </div>
    </div>
  );
}
