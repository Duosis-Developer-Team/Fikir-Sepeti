"use client";

import { useState } from "react";
import { rebuildTeams, partition } from "@/lib/hackathon";
import type { StageContext } from "../contract";
import { GOLD, dim } from "../contract";
import { Card, GoldButton, Avatar, StageHeadline } from "../ui";

export function TeamStage(ctx: StageContext) {
  const { data, config, isAdmin, refresh } = ctx;
  const { basket, participants, teams, members } = data;
  const mode = config.teamMode ?? "solo";
  const built = teams.length > 0;

  const nameOf = (uid: string) => {
    const p = participants.find((x) => x.user_id === uid);
    return p?.display_name || p?.email || uid;
  };
  const build = async (spec: { name: string; members: string[] }[]) => {
    await rebuildTeams(basket.id, spec);
    refresh();
  };
  const doAuto = async () => {
    const ids = participants.map((p) => p.user_id);
    if (mode === "solo") await build(ids.map((id) => ({ name: nameOf(id), members: [id] })));
    else if (mode === "one") await build([{ name: "Tek Takım", members: ids }]);
    else {
      const count = config.groups?.count ?? 3;
      const buckets = partition(ids, count, true);
      await build(buckets.map((m, i) => ({ name: `Takım ${i + 1}`, members: m })));
    }
  };

  // manuel atama (sadece groups + manual)
  const [assign, setAssign] = useState<Record<string, number>>({});
  const count = config.groups?.count ?? 3;
  const saveManual = async () => {
    const buckets = Array.from({ length: count }, () => [] as string[]);
    participants.forEach((p) => {
      const t = assign[p.user_id];
      if (t != null) buckets[t].push(p.user_id);
    });
    await build(buckets.map((m, i) => ({ name: `Takım ${i + 1}`, members: m })));
  };

  // ── kurulmuş takımlar ──
  if (built) {
    return (
      <div className="mx-auto max-w-[1100px]">
        <StageHeadline pre="Takımlar" accent="hazır" sub="Yapım başlasın — sonra demo." />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((t) => {
            const mem = members.filter((m) => m.team_id === t.id);
            return (
              <Card key={t.id}>
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-[1.2rem] font-bold" style={{ color: GOLD }}>{t.name}</h3>
                  <span className="tnum text-[0.82rem]" style={{ color: dim(0.45) }}>{mem.length} kişi</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {mem.map((m) => <Avatar key={m.id} name={nameOf(m.user_id)} size={34} ring="#242424" />)}
                  {!mem.length && <span className="text-[0.85rem]" style={{ color: dim(0.4) }}>boş</span>}
                </div>
              </Card>
            );
          })}
        </div>
        {isAdmin && (
          <div className="mt-6 flex justify-center">
            <button onClick={() => build([])} className="rounded-full border px-6 py-3 text-[0.9rem] transition hover:bg-white/10" style={{ borderColor: "rgba(255,255,255,0.2)", color: dim(0.8) }}>Takımları sıfırla</button>
          </div>
        )}
      </div>
    );
  }

  // ── henüz kurulmadı ──
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-[560px]">
        <StageHeadline pre="Takımlar" accent="kuruluyor" sub="Admin dağıtıyor — birazdan." />
      </div>
    );
  }

  if (mode === "groups" && config.groups?.assignment === "manual") {
    return (
      <div className="mx-auto max-w-[760px]">
        <StageHeadline pre="Elle takım" accent="ata" sub="Her kişiye bir takım seç." />
        <Card>
          <div className="flex flex-col gap-2.5">
            {participants.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-2xl px-4 py-2.5" style={{ background: "#2A2A2A", border: "1px solid rgba(255,255,255,0.08)" }}>
                <span className="flex-1 text-[0.95rem]" style={{ color: "#EDEDED" }}>{nameOf(p.user_id)}</span>
                <div className="flex gap-1.5">
                  {Array.from({ length: count }, (_, i) => {
                    const on = assign[p.user_id] === i;
                    return (
                      <button key={i} onClick={() => setAssign((a) => ({ ...a, [p.user_id]: i }))} className="h-8 w-8 rounded-lg text-[0.85rem] font-bold transition" style={{ background: on ? GOLD : "#3a3a3a", color: on ? "#17150F" : "#EDEDED" }}>{i + 1}</button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5"><GoldButton onClick={saveManual}>Takımları kaydet →</GoldButton></div>
        </Card>
      </div>
    );
  }

  const hint = mode === "solo" ? "Herkes kendi başına — her kişi bir takım." : mode === "one" ? "Herkes tek takım — birlikte." : `${count} takıma rastgele bölünecek.`;
  return (
    <div className="mx-auto max-w-[600px]">
      <StageHeadline pre="Takımları" accent="kur" sub={`${hint} · ${participants.length} katılımcı`} />
      <div className="flex justify-center"><GoldButton onClick={doAuto}>Oluştur →</GoldButton></div>
    </div>
  );
}
