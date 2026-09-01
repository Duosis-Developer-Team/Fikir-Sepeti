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
  const [needsJoinAction, setNeedsJoinAction] = useState(false);
  // admin üst stepper'dan geçmiş bir aşamayı önizliyorsa gerçek fazdan farklı olur — bkz. Stepper.
  const [viewPhase, setViewPhase] = useState<StagePhase | null>(null);
  const livePhaseKey = (data && PHASE_ORDER.includes(data.basket.phase as StagePhase) ? data.basket.phase : "lobby") as StagePhase;
  useEffect(() => {
    setViewPhase(null);
  }, [livePhaseKey]);

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

  const doJoin = useCallback(() => {
    if (!user || !data) return;
    setNeedsJoinAction(false);
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

  // Onay bekleyen katılımcı: admin onaylayınca hackathon_participants realtime abonesi
  // zaten `load()`'u tetikliyor, ama "Onay bekleniyor" ekranını süren joinPending state'i
  // hiçbir zaman yeniden değerlendirilmiyordu — sadece F5 ile yeniden mount olunca temizleniyordu.
  useEffect(() => {
    if (!user || !data || !joinPending) return;
    const me = data.participants.find((p) => p.user_id === user.email);
    if (me && me.approved !== false) setJoinPending(false);
  }, [user, data, joinPending]);

  // lobiye katılım kararı (bir kez) — sahip ve davet linkiyle gelen otomatik
  // katılır; sadece sepet listesinden tıklayan biri "Katıl" butonunu görür (FS-10).
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
    const hasInvite =
      typeof window !== "undefined" && new URLSearchParams(window.location.search).has("invite");
    // Only the casual "opened it from the pool list while still in lobby" case needs an
    // explicit click — late join (allowLateJoin, phase already advanced) keeps auto-joining,
    // since there's no lobby screen left to show a "Katıl" button on.
    const inLobbyPhase = data.basket.phase === "lobby";
    if (isOwner || hasInvite || !inLobbyPhase) {
      doJoin();
    } else {
      setNeedsJoinAction(true);
    }
  }, [user, data, basketId, doJoin]);

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

  const phase = livePhaseKey;
  const displayPhase = viewPhase ?? phase;
  const viewingLive = displayPhase === phase;
  const isAdmin = data.basket.created_by === user.email;
  const ctx: StageContext = {
    data,
    config: data.basket.config ?? {},
    user,
    // geçmişe bakarken mutasyon yüzeyini kapat — çoğu aşama zaten isAdmin'e göre
    // yazma kontrollerini gizliyor, bu yüzden burada false vermek yeterli.
    isAdmin: isAdmin && viewingLive,
    refresh: load,
    needsJoinAction,
    onJoin: doJoin,
    readOnly: !viewingLive,
  };
  const def = STAGES[displayPhase];
  const idx = PHASE_ORDER.indexOf(phase);
  const nextPhase = PHASE_ORDER[idx + 1];
  const prevPhase = PHASE_ORDER[idx - 1];
  const canAdvance = phase !== "done" && phase !== "production" && STAGES[phase].canAdvance(ctx);

  // faza gir (hackathon'a girerken geri sayımı başlat) — sadece gerçek fazı değiştirir
  const enterPhase = async (p: StagePhase) => {
    if (p === phase) return;
    if (p === "hackathon" && !data.basket.hackathon_ends_at) await startHackathonTimer(basketId, ctx.config);
    await setBasketPhase(basketId, p);
    load();
  };
  const advance = () => { if (nextPhase) void enterPhase(nextPhase); };
  const goBack = () => { if (prevPhase) void setBasketPhase(basketId, prevPhase).then(load); };
  // stepper'dan bir adıma tıklamak sadece görüntüler — basket.phase'i değiştirmez.
  const viewOnly = (p: StagePhase) => setViewPhase(p === phase ? null : p);

  return (
    <div className="pb-40">
      {/* stepper — admin daha önce ulaşılmış herhangi bir aşamayı salt okunur önizleyebilir */}
      <Stepper phase={phase} displayPhase={displayPhase} isAdmin={isAdmin} onView={viewOnly} />

      {/* aktif modül — fazlar arası orkestre giriş */}
      <motion.div
        key={displayPhase}
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
            {!viewingLive ? (
              <>
                <span className="px-1 text-[0.82rem]" style={{ color: dim(0.5) }}>
                  Geçmiş görünüm · {PHASE_LABEL[displayPhase]} (salt okunur)
                </span>
                <button
                  onClick={() => setViewPhase(null)}
                  className="rounded-full px-6 py-2.5 text-[0.9rem] font-semibold transition hover:opacity-90"
                  style={{ background: GOLD, color: "#17150F" }}
                >
                  Canlıya dön: {PHASE_LABEL[phase]} →
                </button>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stepper({
  phase,
  displayPhase,
  isAdmin,
  onView,
}: {
  phase: StagePhase;
  displayPhase: StagePhase;
  isAdmin: boolean;
  onView: (p: StagePhase) => void;
}) {
  const steps = PHASE_ORDER.filter((p) => p !== "done");
  const activeReal = Math.min(PHASE_ORDER.indexOf(phase), steps.length - 1);
  const activeDisplay = Math.min(PHASE_ORDER.indexOf(displayPhase), steps.length - 1);
  return (
    <div className="mx-auto max-w-[1080px] px-2">
      <div
        className="flex items-center gap-1"
        style={{ background: "rgba(var(--border-rgb),0.05)", border: "1px solid rgba(var(--border-rgb),0.08)", borderRadius: 999, padding: 5 }}
      >
        {steps.map((p, i) => {
          // sadece daha önce ulaşılmış aşamalar önizlenebilir — ileri atlama yok (bu eski bug'ın kaynağıydı).
          const reached = i <= activeReal;
          const viewing = i === activeDisplay;
          const st = viewing
            ? { background: GOLD, color: "var(--bg)", boxShadow: `0 6px 18px -6px ${GOLD}` }
            : reached
              ? { background: "rgba(231,169,63,0.13)", color: GOLD_SOFT }
              : { background: "transparent", color: dim(0.42) };
          const clickable = isAdmin && reached;
          const cls = `relative flex-1 whitespace-nowrap rounded-full px-3 py-2.5 text-center text-[0.85rem] font-semibold transition-colors ${clickable ? "cursor-pointer" : "cursor-default"}`;
          const content = (
            <>
              {PHASE_LABEL[p]}
              {p === phase && !viewing && (
                <span className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full" style={{ background: GOLD }} aria-hidden />
              )}
            </>
          );
          return clickable ? (
            <motion.button key={p} whileTap={{ scale: 0.96 }} onClick={() => onView(p)} className={cls} style={st}>
              {content}
            </motion.button>
          ) : (
            <div key={p} className={cls} style={st} aria-disabled="true" tabIndex={-1}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
