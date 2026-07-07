"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { HackathonConfig } from "@/lib/types";
import { setConfig } from "@/lib/hackathon";
import { setBasketPhase } from "@/lib/db";
import type { StageContext } from "../contract";
import { GOLD, GOLD_SOFT, dim } from "../contract";
import { Card, GoldButton, StageHeadline } from "../ui";
import { InvitePanel } from "../InvitePanel";

type Sub = "invite" | "ideaSource" | "poolSelect" | "teamMode" | "groups" | "ready";

export function LobbyStage({ data, config, isAdmin, refresh }: StageContext) {
  const { basket, participants } = data;
  const [sub, setSub] = useState<Sub>("invite");

  const write = (c: HackathonConfig) => setConfig(basket.id, c).then(refresh);
  const patch = (p: Partial<HackathonConfig>) => write({ ...config, ...p });
  const patchGroups = (g: Partial<NonNullable<HackathonConfig["groups"]>>) =>
    patch({ groups: { count: 3, size: 4, assignment: "random", ...config.groups, ...g } });

  const prevOf = (s: Sub): Sub | null => {
    switch (s) {
      case "ideaSource": return "invite";
      case "poolSelect": return "ideaSource";
      case "teamMode": return config.ideaSource === "pool" ? "poolSelect" : "ideaSource";
      case "groups": return "teamMode";
      case "ready": return config.teamMode === "groups" ? "groups" : "teamMode";
      default: return null;
    }
  };

  const start = () => setBasketPhase(basket.id, "idea").then(refresh);

  // ── katılımcı (admin değil) → sade bekleme ──
  if (!isAdmin) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-[680px] flex-col justify-center text-center">
        <StageHeadline pre="Lobide" accent="bekle" sub={`${basket.created_by ?? "Admin"} kuruyor. Başlayınca ekran değişecek.`} />
        <p className="text-[0.95rem]" style={{ color: dim(0.5) }}>{participants.length} kişi katıldı</p>
      </div>
    );
  }

  const back = prevOf(sub);

  return (
    <div className="mx-auto flex min-h-[64vh] w-full max-w-[900px] flex-col justify-center overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={sub}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.34, ease: EASE }}
        >
      {sub === "invite" && (
        <>
          <StageHeadline pre="Önce ekibi" accent="topla" sub="Linki paylaş — açan herkes iş e-postasıyla lobiye katılır. Sonra akışı kur." />
          <InvitePanel basketId={basket.id} />
          <p className="mt-5 text-center text-[0.92rem]" style={{ color: dim(0.5) }}>{participants.length} kişi katıldı</p>
        </>
      )}

      {sub === "ideaSource" && (
        <>
          <StageHeadline pre="Fikir" accent="nereden" post=" gelecek?" />
          <Choice
            value={config.ideaSource}
            onChange={(v) => { patch({ ideaSource: v }); setSub(v === "pool" ? "poolSelect" : "teamMode"); }}
            options={[
              { v: "static", label: "Fikir var", hint: "sen girersin" },
              { v: "pool", label: "Brainstorming", hint: "herkes yazar" },
            ]}
          />
        </>
      )}

      {sub === "poolSelect" && (
        <>
          <StageHeadline pre="Pool nasıl" accent="seçilsin?" />
          <Choice
            value={config.poolSelect}
            onChange={(v) => { patch({ poolSelect: v }); setSub("teamMode"); }}
            options={[
              { v: "vote", label: "Oylama", hint: "en çok oy" },
              { v: "random", label: "Kura", hint: "rastgele" },
            ]}
          />
        </>
      )}

      {sub === "teamMode" && (
        <>
          <StageHeadline pre="Kim" accent="kiminle?" />
          <Choice
            value={config.teamMode}
            onChange={(v) => { patch({ teamMode: v }); setSub(v === "groups" ? "groups" : "ready"); }}
            options={[
              { v: "solo", label: "Herkes tek", hint: "solo" },
              { v: "groups", label: "Gruplar", hint: "N takım" },
              { v: "one", label: "Tek takım", hint: "hep birlikte" },
            ]}
          />
        </>
      )}

      {sub === "groups" && (
        <>
          <StageHeadline pre="Grupları" accent="ayarla" />
          <div className="mx-auto grid w-full max-w-[560px] grid-cols-2 gap-4 sm:grid-cols-3">
            <NumField label="Kaç takım" value={config.groups?.count ?? 3} min={2} onChange={(n) => patchGroups({ count: n })} />
            <NumField label="Kişi/takım" value={config.groups?.size ?? 4} min={1} onChange={(n) => patchGroups({ size: n })} />
            <div className="flex flex-col gap-2">
              <span className="text-[0.72rem] font-semibold uppercase tracking-[0.2em]" style={{ color: dim(0.5) }}>Atama</span>
              <div className="flex gap-2">
                {(["random", "manual"] as const).map((a) => {
                  const on = config.groups?.assignment === a;
                  return <button key={a} onClick={() => patchGroups({ assignment: a })} className="flex-1 rounded-xl py-2.5 text-[0.9rem] font-semibold transition" style={{ background: on ? "rgba(231,169,63,0.14)" : "#2A2A2A", border: `1px solid ${on ? GOLD : "rgba(255,255,255,0.09)"}`, color: on ? GOLD : "#EDEDED" }}>{a === "random" ? "Random" : "Elle"}</button>;
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {sub === "ready" && (
        <div className="text-center">
          <StageHeadline pre="Hazır" accent="mısın?" sub="Kurulum tamam. Başlat'a bas, hackathon başlasın." />
          <Summary config={config} />
        </div>
      )}

        </motion.div>
      </AnimatePresence>

      {/* nav — geri her zaman, ileri adıma göre */}
      <div className="mt-12 flex items-center justify-center gap-3">
        {back && (
          <button onClick={() => setSub(back)} className="rounded-full border px-6 py-3 text-[0.95rem] transition hover:bg-white/10" style={{ borderColor: "rgba(255,255,255,0.2)", color: dim(0.85) }}>← Geri</button>
        )}
        {sub === "invite" && <GoldButton onClick={() => setSub("ideaSource")}>Kuruluma geç →</GoldButton>}
        {sub === "groups" && <GoldButton onClick={() => setSub("ready")}>Devam →</GoldButton>}
        {sub === "ready" && <GoldButton onClick={start}>Başlat →</GoldButton>}
      </div>
    </div>
  );
}

function Choice<T extends string>({ value, options, onChange }: { value?: T; options: { v: T; label: string; hint?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap justify-center gap-5">
      {options.map((o, i) => {
        const on = value === o.v;
        return (
          <motion.button
            key={o.v}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, ease: EASE, delay: 0.08 + i * 0.07 }}
            whileHover={{ y: -6 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onChange(o.v)}
            className="min-w-[210px] rounded-[24px] px-10 py-9 text-center"
            style={{
              background: on ? "rgba(231,169,63,0.12)" : "#242424",
              border: `1px solid ${on ? GOLD : "rgba(255,255,255,0.09)"}`,
              boxShadow: on ? "0 20px 50px -28px rgba(231,169,63,0.65)" : "none",
            }}
          >
            <span className="font-display block text-[1.75rem] font-bold" style={{ color: on ? GOLD : "#EDEDED" }}>{o.label}</span>
            {o.hint && <span className="mt-1.5 block text-[1rem]" style={{ color: dim(0.5) }}>{o.hint}</span>}
          </motion.button>
        );
      })}
    </div>
  );
}

function NumField({ label, value, min, onChange }: { label: string; value: number; min: number; onChange: (n: number) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[0.72rem] font-semibold uppercase tracking-[0.2em]" style={{ color: dim(0.5) }}>{label}</span>
      <input type="number" min={min} value={value} onChange={(e) => onChange(Math.max(min, +e.target.value))} className="w-full rounded-xl px-3 py-3 text-center font-display text-[1.3rem] font-bold outline-none" style={{ background: "#2A2A2A", border: "1px solid rgba(255,255,255,0.09)", color: "#EDEDED" }} />
    </div>
  );
}

const EASE = [0.22, 0.85, 0.25, 1] as const;

const IDEA_LABEL: Record<string, string> = { static: "Fikir var", pool: "Brainstorming" };
const POOL_LABEL: Record<string, string> = { vote: "Oylama", random: "Kura" };
const TEAM_LABEL: Record<string, string> = { solo: "Herkes tek", groups: "Gruplar", one: "Tek takım" };

function Summary({ config }: { config: HackathonConfig }) {
  const items = [
    config.ideaSource && `Fikir: ${IDEA_LABEL[config.ideaSource]}`,
    config.poolSelect && `Seçim: ${POOL_LABEL[config.poolSelect]}`,
    config.teamMode && `Takım: ${TEAM_LABEL[config.teamMode]}`,
    config.teamMode === "groups" && config.groups && `${config.groups.count} takım · ${config.groups.assignment === "random" ? "random" : "elle"}`,
  ].filter(Boolean) as string[];
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-2">
      {items.map((t) => (
        <span key={t} className="rounded-full px-4 py-2 text-[0.9rem]" style={{ background: "rgba(231,169,63,0.1)", color: GOLD_SOFT }}>{t}</span>
      ))}
    </div>
  );
}
