"use client";

import type { HackathonConfig } from "@/lib/types";
import { setConfig } from "@/lib/hackathon";
import type { StageContext } from "../contract";
import { GOLD, GOLD_SOFT, dim } from "../contract";
import { Seg, Field, Card, Avatar } from "../ui";
import { InvitePanel } from "../InvitePanel";

const IDEA_LABEL: Record<string, string> = { static: "Fikir var", pool: "Brainstorming" };
const POOL_LABEL: Record<string, string> = { vote: "Oylama", random: "Kura" };
const TEAM_LABEL: Record<string, string> = { solo: "Herkes tek", groups: "Gruplar", one: "Tek takım" };

export function LobbyStage({ data, config, isAdmin, refresh }: StageContext) {
  const { basket, participants } = data;

  const write = (c: HackathonConfig) => setConfig(basket.id, c).then(refresh);
  const patch = (p: Partial<HackathonConfig>) => write({ ...config, ...p });
  const patchGroups = (g: Partial<NonNullable<HackathonConfig["groups"]>>) =>
    patch({ groups: { count: 3, size: 4, assignment: "random", ...config.groups, ...g } });

  // sıradaki adım config'ten türetilir — cevaplar dolunca otomatik ilerler
  const step: "ideaSource" | "poolSelect" | "teamMode" | "groups" | "ready" =
    !config.ideaSource
      ? "ideaSource"
      : config.ideaSource === "pool" && !config.poolSelect
        ? "poolSelect"
        : !config.teamMode
          ? "teamMode"
          : config.teamMode === "groups" && !config.groups
            ? "groups"
            : "ready";

  // seçilmişleri düzenlemek için: o adımdan sonrasını temizle
  const editIdea = () => write({});
  const editPool = () => write({ ideaSource: config.ideaSource });
  const editTeam = () => write({ ideaSource: config.ideaSource, poolSelect: config.poolSelect });

  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-6">
      {/* 1) davet — ilk ekranda öne çıkar */}
      <InvitePanel basketId={basket.id} />

      {/* 2) kurulum — admin için sıralı wizard */}
      {isAdmin ? (
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[1.35rem] font-bold" style={{ color: "#EDEDED" }}>Kurulum</h2>
            {step !== "ready" && <span className="text-[0.82rem]" style={{ color: dim(0.45) }}>{stepNo(step, config)}/{totalSteps(config)}</span>}
          </div>

          {/* seçilmiş cevaplar — tıkla değiştir */}
          {(config.ideaSource || config.teamMode) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {config.ideaSource && <Chip label={`Fikir: ${IDEA_LABEL[config.ideaSource]}`} onClick={editIdea} />}
              {config.poolSelect && <Chip label={`Seçim: ${POOL_LABEL[config.poolSelect]}`} onClick={editPool} />}
              {config.teamMode && <Chip label={`Takım: ${TEAM_LABEL[config.teamMode]}`} onClick={editTeam} />}
            </div>
          )}

          <div className="mt-6">
            {step === "ideaSource" && (
              <Field label="Fikir kaynağı">
                <Seg
                  value={config.ideaSource}
                  onChange={(v) => patch({ ideaSource: v })}
                  options={[
                    { v: "static", label: "Fikir var", hint: "sen girersin" },
                    { v: "pool", label: "Brainstorming", hint: "herkes yazar" },
                  ]}
                />
              </Field>
            )}

            {step === "poolSelect" && (
              <Field label="Pool'dan seçim">
                <Seg
                  value={config.poolSelect}
                  onChange={(v) => patch({ poolSelect: v })}
                  options={[
                    { v: "vote", label: "Oylama", hint: "en çok oy" },
                    { v: "random", label: "Kura", hint: "rastgele" },
                  ]}
                />
              </Field>
            )}

            {step === "teamMode" && (
              <Field label="Takım modu">
                <Seg
                  value={config.teamMode}
                  onChange={(v) => patch({ teamMode: v })}
                  options={[
                    { v: "solo", label: "Herkes tek", hint: "solo" },
                    { v: "groups", label: "Gruplar", hint: "N takım" },
                    { v: "one", label: "Tek takım", hint: "hep birlikte" },
                  ]}
                />
              </Field>
            )}

            {step === "groups" && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="Kaç takım">
                  <input type="number" min={2} value={config.groups?.count ?? 3} onChange={(e) => patchGroups({ count: Math.max(1, +e.target.value) })} className="w-full rounded-lg px-3 py-2.5 text-[0.95rem] outline-none" style={{ background: "#2A2A2A", border: "1px solid rgba(255,255,255,0.09)", color: "#EDEDED" }} />
                </Field>
                <Field label="Kişi/takım">
                  <input type="number" min={1} value={config.groups?.size ?? 4} onChange={(e) => patchGroups({ size: Math.max(1, +e.target.value) })} className="w-full rounded-lg px-3 py-2.5 text-[0.95rem] outline-none" style={{ background: "#2A2A2A", border: "1px solid rgba(255,255,255,0.09)", color: "#EDEDED" }} />
                </Field>
                <Field label="Atama">
                  <Seg value={config.groups?.assignment} onChange={(v) => patchGroups({ assignment: v })} options={[{ v: "random", label: "Random" }, { v: "manual", label: "Elle" }]} />
                </Field>
              </div>
            )}

            {step === "ready" && (
              <div className="flex items-center gap-3 rounded-2xl px-5 py-4" style={{ background: "rgba(51,194,147,0.1)", border: "1px solid rgba(51,194,147,0.3)" }}>
                <span className="text-[1.3rem]">✓</span>
                <div>
                  <p className="font-display text-[1.05rem] font-bold" style={{ color: "#EDEDED" }}>Kurulum hazır</p>
                  <p className="text-[0.88rem]" style={{ color: dim(0.55) }}>Alttaki <b style={{ color: GOLD_SOFT }}>Sonraki: Fikir →</b> ile başlat.</p>
                </div>
              </div>
            )}
          </div>
        </Card>
      ) : (
        <Card>
          <span className="inline-flex items-center gap-2 text-[0.8rem] font-semibold uppercase tracking-[0.2em]" style={{ color: GOLD }}>
            <span className="h-2 w-2 rounded-full" style={{ background: GOLD, animation: "fs-livedot 2s ease-in-out infinite" }} />
            Lobide
          </span>
          <h2 className="font-display mt-3 text-[1.5rem] font-bold" style={{ color: "#EDEDED" }}>Başlaması bekleniyor…</h2>
          <p className="mt-1.5 text-[0.95rem]" style={{ color: dim(0.5) }}>{basket.created_by ?? "Admin"} kurulumu yapıyor. Sen katıldın.</p>
        </Card>
      )}

      {/* 3) katılımcılar */}
      <Card>
        <div className="flex items-baseline justify-between">
          <span className="text-[0.72rem] font-semibold uppercase tracking-[0.22em]" style={{ color: dim(0.5) }}>Katılımcılar</span>
          <span className="font-display text-[1.1rem] font-bold" style={{ color: "#EDEDED" }}>{participants.length}</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2.5">
          {participants.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3" style={{ background: "#2A2A2A", border: `1px solid ${p.role === "admin" ? "rgba(231,169,63,0.4)" : "rgba(255,255,255,0.08)"}` }}>
              <Avatar name={p.display_name || p.email || p.user_id} size={26} />
              <span className="text-[0.9rem]" style={{ color: "#EDEDED" }}>{p.display_name || p.email || p.user_id}</span>
              {p.role === "admin" && <span className="text-[0.68rem] font-semibold uppercase tracking-[0.12em]" style={{ color: GOLD }}>admin</span>}
            </span>
          ))}
          {!participants.length && <p className="text-[0.9rem]" style={{ color: dim(0.4) }}>Henüz kimse yok.</p>}
        </div>
      </Card>
    </div>
  );
}

function Chip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.85rem] transition hover:bg-white/10" style={{ background: "rgba(231,169,63,0.12)", color: GOLD_SOFT }}>
      {label} <span style={{ opacity: 0.6 }}>✎</span>
    </button>
  );
}

function totalSteps(c: HackathonConfig): number {
  let n = 2; // ideaSource + teamMode
  if (c.ideaSource === "pool") n += 1;
  if (c.teamMode === "groups") n += 1;
  return n;
}
function stepNo(step: string, c: HackathonConfig): number {
  const order = ["ideaSource", "poolSelect", "teamMode", "groups"].filter((s) => {
    if (s === "poolSelect") return c.ideaSource === "pool";
    if (s === "groups") return c.teamMode === "groups";
    return true;
  });
  return Math.min(order.indexOf(step) + 1, totalSteps(c));
}
