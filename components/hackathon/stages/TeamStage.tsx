"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { rebuildTeams, partition, startHackathonTimer, renameTeam } from "@/lib/hackathon";
import { setBasketPhase } from "@/lib/db";
import type { StageContext } from "../contract";
import { GOLD, dim } from "../contract";
import { GoldButton, Avatar, StageHeadline } from "../ui";

export function TeamStage(ctx: StageContext) {
  const { data, config, isAdmin, refresh } = ctx;
  const { basket, participants, teams, members } = data;

  const startHackathon = async () => {
    if (!basket.hackathon_ends_at) await startHackathonTimer(basket.id, config);
    await setBasketPhase(basket.id, "hackathon");
    refresh();
  };
  const mode = config.teamMode ?? "solo";
  const built = teams.length > 0;

  const nameOf = (uid: string) => {
    const p = participants.find((x) => x.user_id === uid);
    return p?.display_name || p?.email || uid;
  };
  const build = async (spec: { name: string; members: string[] }[]) => {
    await rebuildTeams(basket.id, basket.tenant_id, spec);
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

  // takım ismi düzenleme (kurulmuş takımlarda)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const saveRename = async () => {
    if (editingId) { await renameTeam(editingId, editName); setEditingId(null); refresh(); }
  };

  // manuel atama (sadece groups + manual) — sürükle-bırak
  const [assign, setAssign] = useState<Record<string, number | undefined>>({});
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const count = config.groups?.count ?? 3;
  const assignTo = (uid: string, ti: number | undefined) => setAssign((a) => ({ ...a, [uid]: ti }));
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
          {teams.map((t, idx) => {
            const mem = members.filter((m) => m.team_id === t.id);
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.42, ease: [0.22, 0.85, 0.25, 1], delay: idx * 0.08 }}
                whileHover={{ y: -4 }}
                className="rounded-[22px] p-6"
                style={{ background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.09)", boxShadow: "var(--card-shadow)" }}
              >
                <div className="flex items-center justify-between gap-2">
                  {isAdmin && editingId === t.id ? (
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={saveRename}
                      onKeyDown={(e) => { if (e.key === "Enter") saveRename(); if (e.key === "Escape") setEditingId(null); }}
                      className="font-display w-full rounded-lg px-2 py-1 text-[1.2rem] font-bold outline-none"
                      style={{ background: "var(--surface-2)", border: `1px solid ${GOLD}`, color: GOLD }}
                    />
                  ) : (
                    <button
                      onClick={() => { if (isAdmin) { setEditingId(t.id); setEditName(t.name); } }}
                      className="group inline-flex items-center gap-1.5"
                      style={{ cursor: isAdmin ? "text" : "default" }}
                    >
                      <span className="font-display text-[1.2rem] font-bold" style={{ color: GOLD }}>{t.name}</span>
                      {isAdmin && (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-0 transition-opacity group-hover:opacity-60" aria-hidden><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                      )}
                    </button>
                  )}
                  <span className="tnum shrink-0 text-[0.82rem]" style={{ color: dim(0.45) }}>{mem.length} kişi</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {mem.map((m) => <Avatar key={m.id} name={nameOf(m.user_id)} size={34} ring="var(--card)" />)}
                  {!mem.length && <span className="text-[0.85rem]" style={{ color: dim(0.4) }}>boş</span>}
                </div>
              </motion.div>
            );
          })}
        </div>
        {isAdmin && (
          <div className="mt-9 flex flex-col items-center gap-3.5">
            <GoldButton onClick={startHackathon}>Hackathon&apos;u başlat →</GoldButton>
            <button onClick={() => build([])} className="text-[0.85rem] transition hover:opacity-70" style={{ color: dim(0.45) }}>takımları yeniden dağıt</button>
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
    const inTeam = (ti: number) => participants.filter((p) => assign[p.user_id] === ti);
    const unassigned = participants.filter((p) => assign[p.user_id] == null);
    const dropTo = (ti: number | undefined) => (e: React.DragEvent) => {
      e.preventDefault();
      const uid = e.dataTransfer.getData("text/plain");
      if (uid) assignTo(uid, ti);
      setOverIdx(null);
    };
    const Chip = ({ uid }: { uid: string }) => (
      <div
        draggable
        onDragStart={(e) => e.dataTransfer.setData("text/plain", uid)}
        className="flex cursor-grab items-center gap-2 rounded-full py-1 pl-1 pr-3 transition active:cursor-grabbing"
        style={{ background: "var(--surface-2)", border: "1px solid rgba(var(--border-rgb),0.1)" }}
      >
        <Avatar name={nameOf(uid)} size={26} />
        <span className="text-[0.9rem]" style={{ color: "var(--text)" }}>{nameOf(uid)}</span>
      </div>
    );
    return (
      <div className="mx-auto max-w-[980px]">
        <StageHeadline pre="Elle takım" accent="ata" sub="Kişileri sürükleyip takımlara bırak." />
        {/* atanmamış havuz */}
        <div onDragOver={(e) => e.preventDefault()} onDrop={dropTo(undefined)} className="mb-5 rounded-2xl p-4" style={{ background: "var(--card)", border: "1px dashed rgba(var(--border-rgb),0.2)" }}>
          <span className="text-[0.7rem] font-semibold uppercase tracking-[0.2em]" style={{ color: dim(0.5) }}>Atanmamış · {unassigned.length}</span>
          <div className="mt-3 flex flex-wrap gap-2">
            {unassigned.map((p) => <Chip key={p.id} uid={p.user_id} />)}
            {!unassigned.length && <span className="text-[0.85rem]" style={{ color: dim(0.35) }}>hepsi atandı ✓</span>}
          </div>
        </div>
        {/* takım kutuları */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: count }, (_, ti) => (
            <div
              key={ti}
              onDragOver={(e) => { e.preventDefault(); setOverIdx(ti); }}
              onDragLeave={() => setOverIdx((o) => (o === ti ? null : o))}
              onDrop={dropTo(ti)}
              className="min-h-[132px] rounded-2xl p-4 transition"
              style={{ background: "var(--card)", border: `1px solid ${overIdx === ti ? GOLD : "rgba(var(--border-rgb),0.09)"}`, boxShadow: "var(--card-shadow)" }}
            >
              <span className="font-display block text-[1.05rem] font-bold" style={{ color: GOLD }}>Takım {ti + 1}</span>
              <div className="mt-3 flex flex-wrap gap-2">
                {inTeam(ti).map((p) => <Chip key={p.id} uid={p.user_id} />)}
                {!inTeam(ti).length && <span className="text-[0.82rem]" style={{ color: dim(0.32) }}>buraya sürükle</span>}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 flex justify-center">
          <GoldButton onClick={saveManual} disabled={unassigned.length > 0}>Takımları kaydet →</GoldButton>
        </div>
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
