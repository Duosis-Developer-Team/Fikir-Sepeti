"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { HackathonConfig, Participant } from "@/lib/types";
import { setConfig } from "@/lib/hackathon";
import { ideaStatusLabel } from "@/lib/lobby";
import { DEFAULT_RUBRIC } from "@/lib/scoring";
import { setBasketPhase } from "@/lib/db";
import type { StageContext } from "../contract";
import { GOLD, GOLD_SOFT, dim } from "../contract";
import { GoldButton, StageHeadline, NumberStepper, Segmented, Avatar } from "../ui";
import { InvitePanel } from "../InvitePanel";
import { apiAuthHeaders } from "@/lib/api-headers";

type Sub = "invite" | "ideaSource" | "poolSelect" | "ideaAssign" | "teamMode" | "groups" | "duration" | "scoring" | "ready";

const UNITS: { v: "hour" | "day" | "week"; label: string }[] = [
  { v: "hour", label: "Saat" },
  { v: "day", label: "Gün" },
  { v: "week", label: "Hafta" },
];

function authHeaders(email: string, tenantId: string) {
  return apiAuthHeaders(email, tenantId);
}

function ParticipantChip({ p }: { p: Participant }) {
  const [open, setOpen] = useState(false);
  const label = p.display_name || p.email || p.user_id;
  return (
    <button
      type="button"
      className="relative"
      onClick={() => setOpen((v) => !v)}
      data-testid={`participant-avatar-${p.user_id}`}
    >
      <Avatar name={label} size={36} />
      {open && (
        <span
          className="absolute left-1/2 top-full z-10 mt-2 w-max max-w-[220px] -translate-x-1/2 rounded-xl px-3 py-2 text-left text-[0.8rem] shadow-lg"
          style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid rgba(var(--border-rgb),0.15)" }}
          data-testid={`participant-popover-${p.user_id}`}
        >
          <span className="block font-semibold">{p.display_name || "—"}</span>
          <span className="block" style={{ color: dim(0.55) }}>
            {p.email || p.user_id}
          </span>
          {p.approved === false && (
            <span className="mt-1 block" style={{ color: "#E3A857" }}>
              onay bekliyor
            </span>
          )}
        </span>
      )}
    </button>
  );
}

export function LobbyStage({ data, config, isAdmin, user, refresh }: StageContext) {
  const { basket, participants } = data;
  const [sub, setSub] = useState<Sub>("invite");

  const write = (c: HackathonConfig) => setConfig(basket.id, c).then(refresh);
  const patch = (p: Partial<HackathonConfig>) => write({ ...config, ...p });
  const patchGroups = (g: Partial<NonNullable<HackathonConfig["groups"]>>) =>
    patch({ groups: { count: 3, size: 4, assignment: "random", ...config.groups, ...g } });
  const patchDuration = (d: Partial<NonNullable<HackathonConfig["duration"]>>) =>
    patch({ duration: { value: 1, unit: "day", ...config.duration, ...d } });

  const approved = participants.filter((p) => p.approved !== false);
  const pending = participants.filter((p) => p.approved === false);

  const approve = async (userId: string) => {
    await fetch("/api/lobby/join", {
      method: "PATCH",
      headers: await authHeaders(user.email, basket.tenant_id),
      body: JSON.stringify({
        basket_id: basket.id,
        action: "approve",
        user_id: userId,
      }),
    });
    refresh();
  };

  const prevOf = (s: Sub): Sub | null => {
    switch (s) {
      case "ideaSource": return "invite";
      case "poolSelect": return "ideaSource";
      case "ideaAssign": return "poolSelect";
      case "teamMode":
        return config.ideaSource === "pool" || config.ideaSource === "repo"
          ? "ideaAssign"
          : "ideaSource";
      case "groups": return "teamMode";
      case "duration": return config.teamMode === "groups" ? "groups" : "teamMode";
      case "scoring": return "duration";
      case "ready": return "scoring";
      default: return null;
    }
  };

  const start = () => setBasketPhase(basket.id, "idea").then(refresh);

  // ── katılımcı (admin değil) ──
  if (!isAdmin) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-[680px] flex-col justify-center text-center" data-testid="lobby-member">
        <StageHeadline
          pre="Lobide"
          accent="bekle"
          sub={`${basket.created_by ?? "Admin"} kuruyor. Başlayınca ekran değişecek.`}
        />
        <p className="mt-2 text-[0.95rem]" style={{ color: GOLD_SOFT }} data-testid="lobby-idea-status">
          {ideaStatusLabel(config)}
        </p>
        <p className="mt-3 text-[0.95rem]" style={{ color: dim(0.5) }}>
          {approved.length} kişi katıldı
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {approved.map((p) => (
            <ParticipantChip key={p.id} p={p} />
          ))}
        </div>
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
          <div className="mx-auto mt-6 flex max-w-[640px] flex-col gap-3" data-testid="lobby-policy">
            <Segmented
              label="Katılım"
              value={config.lobbyPolicy ?? "open"}
              onChange={(v) => patch({ lobbyPolicy: v })}
              options={[
                { v: "open", label: "Açık" },
                { v: "approval", label: "Onaylı" },
              ]}
            />
            <Segmented
              label="Geç katılım"
              value={config.allowLateJoin ? "on" : "off"}
              onChange={(v) => patch({ allowLateJoin: v === "on" })}
              options={[
                { v: "off", label: "Kapalı" },
                { v: "on", label: "Açık" },
              ]}
            />
          </div>
          <p className="mt-5 text-center text-[0.92rem]" style={{ color: dim(0.5) }}>
            {approved.length} kişi · {pending.length} onay bekliyor
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {participants.map((p) => (
              <ParticipantChip key={p.id} p={p} />
            ))}
          </div>
          {pending.length > 0 && (
            <div className="mx-auto mt-4 max-w-[480px]" data-testid="lobby-pending-list">
              {pending.map((p) => (
                <div
                  key={p.id}
                  className="mb-2 flex items-center justify-between rounded-xl px-3 py-2"
                  style={{ background: "var(--surface-2)" }}
                >
                  <span style={{ color: "var(--text)" }}>{p.display_name || p.email}</span>
                  <button
                    type="button"
                    className="rounded-full px-3 py-1 text-[0.8rem] font-semibold"
                    style={{ background: GOLD, color: "#17150F" }}
                    onClick={() => void approve(p.user_id)}
                    data-testid={`approve-${p.user_id}`}
                  >
                    Onayla
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {sub === "ideaSource" && (
        <>
          <StageHeadline pre="Fikir" accent="nereden" post=" gelecek?" />
          <Choice
            value={config.ideaSource}
            onChange={(v) => {
              patch({ ideaSource: v });
              if (v === "pool" || v === "repo") setSub("poolSelect");
              else setSub("teamMode");
            }}
            options={[
              { v: "static", label: "Fikir var", hint: "sen girersin" },
              { v: "pool", label: "Brainstorming", hint: "herkes yazar" },
              { v: "repo", label: "Kavanoz", hint: "depodan çek" },
            ]}
          />
        </>
      )}

      {sub === "poolSelect" && (
        <>
          <StageHeadline
            pre={config.ideaSource === "repo" ? "Kavanoz nasıl" : "Pool nasıl"}
            accent="seçilsin?"
          />
          <Choice
            value={config.poolSelect}
            onChange={(v) => { patch({ poolSelect: v }); setSub("ideaAssign"); }}
            options={[
              { v: "vote", label: "Oylama", hint: "en çok oy" },
              { v: "random", label: "Kura", hint: "rastgele" },
            ]}
          />
        </>
      )}

      {sub === "ideaAssign" && (
        <>
          <StageHeadline pre="Dağıtım" accent="nasıl?" sub="Kaç fikir ve kimin fikri kime?" />
          <div className="mx-auto flex w-full max-w-[640px] flex-col items-center gap-8">
            <NumberStepper
              label="Fikir sayısı"
              value={config.ideaCount ?? 1}
              min={1}
              max={8}
              onChange={(n) => patch({ ideaCount: n })}
            />
            <Segmented
              label="Atama"
              value={config.ideaAssignment ?? "same"}
              onChange={(v) => patch({ ideaAssignment: v })}
              options={[
                { v: "same", label: "Same" },
                { v: "cross", label: "Cross" },
                { v: "manual", label: "Elle" },
              ]}
            />
            <Segmented
              label="Çekiliş animasyonu"
              value={config.revealAnimation === false ? "off" : "on"}
              onChange={(v) => patch({ revealAnimation: v === "on" })}
              options={[
                { v: "on", label: "Açık" },
                { v: "off", label: "Kapalı" },
              ]}
            />
          </div>
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

      {sub === "scoring" && (
        <>
          <StageHeadline
            pre="Puanlama"
            accent="nasıl?"
            sub="Basit oy varsayılan. Rubrik = kategori × yıldız."
          />
          <Choice
            value={config.scoringMode ?? "simple"}
            onChange={(v) => {
              if (v === "simple") {
                patch({ scoringMode: "simple", rubric: undefined, juryEnabled: false });
                setSub("ready");
              } else {
                patch({ scoringMode: "rubric" });
              }
            }}
            options={[
              { v: "simple", label: "Basit oy", hint: "tek tık (varsayılan)" },
              { v: "rubric", label: "Rubrik", hint: "kategori + yıldız" },
            ]}
          />
          {config.scoringMode === "rubric" && (
            <div className="mt-8 flex flex-col items-center gap-4" data-testid="rubric-setup">
              <p className="max-w-[420px] text-center text-[0.9rem]" style={{ color: dim(0.55) }}>
                Varsayılan set: {DEFAULT_RUBRIC.map((c) => c.label).join(" · ")}
              </p>
              <GoldButton
                onClick={() => {
                  patch({
                    scoringMode: "rubric",
                    rubric: DEFAULT_RUBRIC,
                    juryEnabled: config.juryEnabled ?? false,
                    juryWeight: config.juryWeight ?? 2,
                  });
                  setSub("ready");
                }}
              >
                Varsayılan seti kabul et →
              </GoldButton>
              <Segmented
                label="Jüri ağırlığı"
                value={config.juryEnabled ? "on" : "off"}
                onChange={(v) =>
                  patch({
                    juryEnabled: v === "on",
                    juryWeight: config.juryWeight ?? 2,
                  })
                }
                options={[
                  { v: "off", label: "Kapalı" },
                  { v: "on", label: "Açık ×2" },
                ]}
              />
            </div>
          )}
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
        {sub === "ideaAssign" && <GoldButton onClick={() => setSub("teamMode")}>Devam →</GoldButton>}
        {sub === "groups" && <GoldButton onClick={() => setSub("duration")}>Devam →</GoldButton>}
        {sub === "duration" && <GoldButton onClick={() => setSub("scoring")}>Devam →</GoldButton>}
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

const IDEA_LABEL: Record<string, string> = {
  static: "Fikir var",
  pool: "Brainstorming",
  repo: "Kavanoz",
};
const POOL_LABEL: Record<string, string> = { vote: "Oylama", random: "Kura" };
const TEAM_LABEL: Record<string, string> = { solo: "Herkes tek", groups: "Gruplar", one: "Tek takım" };

function Summary({ config }: { config: HackathonConfig }) {
  const items = [
    config.ideaSource && `Fikir: ${IDEA_LABEL[config.ideaSource]}`,
    config.poolSelect && `Seçim: ${POOL_LABEL[config.poolSelect]}`,
    config.ideaCount && config.ideaCount > 1 && `${config.ideaCount} fikir`,
    config.ideaAssignment && `Atama: ${config.ideaAssignment}`,
    config.revealAnimation === false && "Animasyon kapalı",
    config.teamMode && `Takım: ${TEAM_LABEL[config.teamMode]}`,
    config.teamMode === "groups" && config.groups && `${config.groups.count} takım · ${config.groups.assignment === "random" ? "random" : "elle"}`,
    config.scoringMode === "rubric" && "Puanlama: Rubrik",
    (config.scoringMode ?? "simple") === "simple" && "Puanlama: Basit",
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
