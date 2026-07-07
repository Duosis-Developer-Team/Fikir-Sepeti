"use client";

import { useState } from "react";
import type { HackathonConfig } from "@/lib/types";
import { setConfig } from "@/lib/hackathon";
import type { StageContext } from "../contract";
import { GOLD, dim, configReady } from "../contract";
import { Seg, Field, Card, initials } from "../ui";
import { InvitePanel } from "../InvitePanel";

export function LobbyStage({ data, config, isAdmin, refresh }: StageContext) {
  const { basket, participants } = data;
  const [saving, setSaving] = useState(false);

  const patch = async (p: Partial<HackathonConfig>) => {
    setSaving(true);
    await setConfig(basket.id, { ...config, ...p });
    setSaving(false);
    refresh();
  };
  const patchGroups = (g: Partial<NonNullable<HackathonConfig["groups"]>>) =>
    patch({ groups: { count: 3, size: 4, assignment: "random", ...config.groups, ...g } });

  return (
    <div className="mx-auto grid max-w-[1100px] gap-6 lg:grid-cols-[1fr_360px]">
      {/* config (admin) ya da bekleme (member) */}
      {isAdmin ? (
        <Card>
          <h2 className="font-display text-[1.3rem] font-bold" style={{ color: "#EDEDED" }}>Kurulum</h2>
          <p className="mt-1 text-[0.9rem]" style={{ color: dim(0.5) }}>Hackathon'u sen açtın — akışı burada kur, sonra başlat.</p>

          <div className="mt-6 flex flex-col gap-6">
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

            {config.ideaSource === "pool" && (
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

            {config.teamMode === "groups" && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="Kaç takım">
                  <input type="number" min={2} value={config.groups?.count ?? 3} onChange={(e) => patchGroups({ count: Math.max(1, +e.target.value) })} className="w-full rounded-lg px-3 py-2.5 text-[0.95rem] outline-none" style={{ background: "#2A2A2A", border: "1px solid rgba(255,255,255,0.09)", color: "#EDEDED" }} />
                </Field>
                <Field label="Kişi/takım">
                  <input type="number" min={1} value={config.groups?.size ?? 4} onChange={(e) => patchGroups({ size: Math.max(1, +e.target.value) })} className="w-full rounded-lg px-3 py-2.5 text-[0.95rem] outline-none" style={{ background: "#2A2A2A", border: "1px solid rgba(255,255,255,0.09)", color: "#EDEDED" }} />
                </Field>
                <Field label="Atama">
                  <Seg
                    value={config.groups?.assignment}
                    onChange={(v) => patchGroups({ assignment: v })}
                    options={[{ v: "random", label: "Random" }, { v: "manual", label: "Elle" }]}
                  />
                </Field>
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
          <h2 className="font-display mt-3 text-[1.6rem] font-bold" style={{ color: "#EDEDED" }}>Başlaması bekleniyor…</h2>
          <p className="mt-1.5 text-[0.95rem]" style={{ color: dim(0.5) }}>
            {basket.created_by ?? "Admin"} kurulumu yapıyor. Sen katıldın — birazdan başlıyoruz.
          </p>
          {configReady(config) && <p className="mt-3 text-[0.9rem]" style={{ color: GOLD }}>Kurulum hazır ✓</p>}
        </Card>
      )}

      {/* sağ kolon: davet (admin) + katılımcılar */}
      <div className="flex flex-col gap-6">
        {isAdmin && <InvitePanel basketId={basket.id} />}
        <Card>
          <div className="flex items-baseline justify-between">
            <span className="text-[0.72rem] font-semibold uppercase tracking-[0.22em]" style={{ color: dim(0.5) }}>Katılımcılar</span>
            <span className="font-display text-[1.1rem] font-bold" style={{ color: "#EDEDED" }}>{participants.length}</span>
          </div>
          <div className="mt-4 flex flex-col gap-2.5">
            {participants.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full text-[0.8rem] font-bold" style={{ background: p.role === "admin" ? GOLD : "#3a3a3a", color: p.role === "admin" ? "#17150F" : "#EDEDED" }}>
                  {initials(p.display_name || p.email || p.user_id)}
                </span>
                <span className="text-[0.95rem]" style={{ color: "#EDEDED" }}>{p.display_name || p.email || p.user_id}</span>
                {p.role === "admin" && <span className="ml-auto text-[0.72rem] font-semibold uppercase tracking-[0.15em]" style={{ color: GOLD }}>admin</span>}
              </div>
            ))}
            {!participants.length && <p className="text-[0.9rem]" style={{ color: dim(0.4) }}>Henüz kimse yok.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
