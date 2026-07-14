"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { HackathonConfig } from "@/lib/types";
import { setConfig } from "@/lib/hackathon";
import { setBasketPhase } from "@/lib/db";
import type { StageContext } from "../contract";
import { GOLD, GOLD_SOFT, dim } from "../contract";
import { GoldButton, StageHeadline, NumberStepper, Segmented } from "../ui";
import { InvitePanel } from "../InvitePanel";

type Sub = "invite" | "ideaSource" | "poolSelect" | "teamMode" | "groups" | "duration" | "ready";

const UNITS: { v: "hour" | "day" | "week"; label: string }[] = [
  { v: "hour", label: "Saat" },
  { v: "day", label: "Gün" },
  { v: "week", label: "Hafta" },
];

export function LobbyStage({ data, config, isAdmin, refresh }: StageContext) {
  const { basket, participants } = data;
  const [sub, setSub] = useState<Sub>("invite");

  const write = (c: HackathonConfig) => setConfig(basket.id, c).then(refresh);
  const patch = (p: Partial<HackathonConfig>) => write({ ...config, ...p });
  const patchGroups = (g: Partial<NonNullable<HackathonConfig["groups"]>>) =>
    patch({ groups: { count: 3, size: 4, assignment: "random", ...config.groups, ...g } });
  const patchDuration = (d: Partial<NonNullable<HackathonConfig["duration"]>>) =>
    patch({ duration: { value: 1, unit: "day", ...config.duration, ...d } });

  const prevOf = (s: Sub): Sub | null => {
    switch (s) {
      case "ideaSource": return "invite";
      case "poolSelect": return "ideaSource";
      case "teamMode": return config.ideaSource === "pool" ? "poolSelect" : "ideaSource";
      case "groups": return "teamMode";
      case "duration": return config.teamMode === "groups" ? "groups" : "teamMode";
      case "ready": return "duration";
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
            onChange={(v) => {
              if (v === "groups") patch({ teamMode: v, groups: { count: 3, size: 4, assignment: "random" } });
              else patch({ teamMode: v });
              setSub(v === "groups" ? "groups" : "duration");
            }}
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
          <div className="mx-auto flex w-full max-w-[600px] flex-wrap items-start justify-center gap-x-10 gap-y-6">
            <NumberStepper label="Kaç takım" value={config.groups?.count ?? 3} min={2} onChange={(n) => patchGroups({ count: n })} />
            <NumberStepper label="Kişi/takım" value={config.groups?.size ?? 4} min={1} onChange={(n) => patchGroups({ size: n })} />
            <Segmented label="Atama" value={config.groups?.assignment} onChange={(v) => patchGroups({ assignment: v })} options={[{ v: "random", label: "Random" }, { v: "manual", label: "Elle" }]} />
          </div>
        </>
      )}

      {sub === "duration" && (
        <>
          <StageHeadline pre="Ne kadar" accent="sürecek?" sub="Hackathon süresini seç — sonra geri sayım başlar." />
          <div className="mx-auto flex max-w-[560px] flex-wrap items-start justify-center gap-x-10 gap-y-6">
            <NumberStepper label="Süre" value={config.duration?.value ?? 1} min={1} max={99} onChange={(n) => patchDuration({ value: n })} />
            <Segmented label="Birim" value={config.duration?.unit ?? "day"} onChange={(v) => patchDuration({ unit: v })} options={UNITS.map((u) => ({ v: u.v, label: u.label }))} />
          </div>
        </>
      )}

      {sub === "ready" && (
        <div className="text-center">
          <StageHeadline pre="Hazır" accent="mısın?" sub={"Kurulum tamam. Başlat'a bas, hackathon başlasın."} />
          <Summary config={config} />
        </div>
      )}

        </motion.div>
      </AnimatePresence>

      {/* nav — geri her zaman, ileri adıma göre */}
      <div className="mt-12 flex items-center justify-center gap-3">
        {back && (
          <button onClick={() => setSub(back)} className="rounded-full border px-6 py-3 text-[0.95rem] transition hover:bg-[rgba(var(--border-rgb),0.08)]" style={{ borderColor: "rgba(var(--border-rgb),0.2)", color: dim(0.85) }}>← Geri</button>
        )}
        {sub === "invite" && <GoldButton onClick={() => setSub("ideaSource")}>Kuruluma geç →</GoldButton>}
        {sub === "groups" && <GoldButton onClick={() => setSub("duration")}>Devam →</GoldButton>}
        {sub === "duration" && <GoldButton onClick={() => setSub("ready")}>Devam →</GoldButton>}
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
              background: on ? "rgba(231,169,63,0.12)" : "var(--card)",
              border: `1px solid ${on ? GOLD : "rgba(var(--border-rgb),0.09)"}`,
              boxShadow: on ? "var(--card-shadow-hover), 0 20px 50px -28px rgba(231,169,63,0.6)" : "var(--card-shadow)",
            }}
          >
            <span className="font-display block text-[1.75rem] font-bold" style={{ color: on ? GOLD : "var(--text)" }}>{o.label}</span>
            {o.hint && <span className="mt-1.5 block text-[1rem]" style={{ color: dim(0.5) }}>{o.hint}</span>}
          </motion.button>
        );
      })}
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
    config.duration && `Süre: ${config.duration.value} ${UNITS.find((u) => u.v === config.duration!.unit)?.label ?? ""}`,
  ].filter(Boolean) as string[];
  return (
    <div className="mt-2 flex flex-wrap justify-center gap-2">
      {items.map((t) => (
        <span key={t} className="rounded-full px-4 py-2 text-[0.9rem]" style={{ background: "rgba(231,169,63,0.1)", color: GOLD_SOFT }}>{t}</span>
      ))}
    </div>
  );
}
