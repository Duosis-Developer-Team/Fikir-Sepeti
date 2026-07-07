"use client";

import { markDone } from "@/lib/hackathon";
import type { StageContext } from "../contract";
import { GOLD, GOLD_SOFT, dim } from "../contract";
import { Card, GoldButton, Avatar } from "../ui";

export function ProductionStage({ data, isAdmin }: StageContext) {
  const { basket, teams, members, teamVotes, ideas, participants } = data;
  const selected = ideas.find((i) => i.id === basket.selected_idea_id) ?? null;
  const votesOf = (id: string) => teamVotes.filter((v) => v.team_id === id).length;
  const winner = [...teams].sort((a, b) => votesOf(b.id) - votesOf(a.id))[0] ?? null;
  const winnerMembers = winner ? members.filter((m) => m.team_id === winner.id) : [];
  const done = basket.status === "resolved" || basket.phase === "done";
  const nameOf = (uid: string) => {
    const p = participants.find((x) => x.user_id === uid);
    return p?.display_name || p?.email || uid;
  };

  const finalize = async () => {
    await markDone(basket.id, selected?.id ?? null);
    // üretime alındı → ana sayfaya dön (tam reload)
    window.location.href = "/";
  };

  return (
    <div className="mx-auto max-w-[640px]">
      <Card className="text-center">
        <span className="text-[0.75rem] font-semibold uppercase tracking-[0.28em]" style={{ color: GOLD }}>
          {done ? "Üretime alındı" : "Production"}
        </span>

        {winner ? (
          <>
            <h2 className="font-display mt-4 text-[clamp(2rem,4vw,3rem)] font-extrabold" style={{ color: "var(--text)" }}>🏆 {winner.name}</h2>
            <p className="mt-1 tnum text-[1rem]" style={{ color: GOLD_SOFT }}>{votesOf(winner.id)} oy</p>
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {winnerMembers.map((m) => (
                <span key={m.id} className="inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-[0.9rem]" style={{ background: "rgba(var(--border-rgb),0.05)", color: "var(--text)" }}>
                  <Avatar name={nameOf(m.user_id)} size={26} />
                  {nameOf(m.user_id)}
                </span>
              ))}
            </div>
          </>
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

        <div className="mt-7">
          {done ? (
            <span className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[0.95rem] font-semibold" style={{ background: "rgba(51,194,147,0.14)", color: "#6FD9B4" }}>✓ Üretime alındı</span>
          ) : isAdmin ? (
            <GoldButton onClick={finalize}>Üretime al · kapat</GoldButton>
          ) : (
            <p className="text-[0.9rem]" style={{ color: dim(0.5) }}>Admin sonuçlandıracak.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
