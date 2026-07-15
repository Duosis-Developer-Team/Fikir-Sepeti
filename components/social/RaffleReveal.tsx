"use client";

import { useState } from "react";
import { addIdea, deleteIdea } from "@/lib/db";
import { soft, type Accent } from "@/lib/accent";
import type { Basket, Idea } from "@/lib/types";
import { RaffleRevealStage } from "@/components/shared/RaffleRevealStage";

/** Social raffle — candidate list + draw; visual stage is shared RaffleRevealStage. */
export function RaffleReveal({
  basket,
  ideas,
  voter,
  accent,
  isOwner,
  onWinner,
}: {
  basket: Basket;
  ideas: Idea[];
  voter: string;
  accent: Accent;
  isOwner: boolean;
  onWinner: (winner: Idea) => void;
}) {
  const [draft, setDraft] = useState("");
  const [stageWinner, setStageWinner] = useState<Idea | null>(null);

  const add = async () => {
    const v = draft.trim();
    if (v.length < 2) return;
    setDraft("");
    await addIdea({ basket_id: basket.id, text: v, created_by: voter, tenant_id: basket.tenant_id });
  };

  const pull = () => {
    if (ideas.length < 2) return;
    const winner = ideas[Math.floor(Math.random() * ideas.length)];
    setStageWinner(winner);
  };

  return (
    <div>
      <div className="flex gap-[10px]">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Yeni aday ekle…"
          className="min-w-0 flex-1 rounded-[14px] px-[18px] py-[15px] text-[1rem] outline-none"
          style={{ background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.10)", color: "var(--text)" }}
          onFocus={(e) => (e.currentTarget.style.borderColor = soft(accent, 0.6))}
          onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(var(--border-rgb),0.10)")}
        />
        <button onClick={add} className="shrink-0 rounded-[14px] px-6 text-[0.95rem] font-semibold" style={{ background: soft(accent, 0.14), color: accent.base }}>Ekle</button>
      </div>

      <div className="mb-[14px] mt-7 text-[0.72rem] font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--text-faint)" }}>Adaylar</div>
      <div className="flex flex-wrap gap-[10px]">
        {ideas.map((idea) => (
          <span key={idea.id} className="inline-flex items-center gap-[10px] rounded-full py-[11px] pl-[18px] pr-2 text-[0.98rem]" style={{ background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.10)", color: "var(--text)" }}>
            {idea.text}
            <button onClick={() => deleteIdea(idea.id)} className="grid h-[22px] w-[22px] place-items-center rounded-full text-[0.9rem] leading-none transition" style={{ background: "rgba(var(--border-rgb),0.06)", color: "var(--text-muted)" }} title="çıkar">×</button>
          </span>
        ))}
        {!ideas.length && <span className="text-sm" style={{ color: "var(--text-muted)" }}>henüz aday yok</span>}
      </div>

      <div className="mt-11 flex flex-col items-center gap-[14px]">
        {isOwner ? (
          <>
            <span className="text-[0.92rem]" style={{ color: "var(--text-muted)" }}>Karar çıkmadı mı? Bırak kura seçsin.</span>
            <button
              onClick={pull}
              disabled={ideas.length < 2}
              className="inline-flex items-center gap-[11px] rounded-full px-11 py-[17px] text-[1.05rem] font-bold transition hover:-translate-y-[3px] disabled:opacity-40"
              style={{ background: accent.base, color: "#0F0F0F", boxShadow: `0 18px 44px -18px ${soft(accent, 0.85)}`, animation: ideas.length < 2 ? "none" : "fs-float 4s ease-in-out infinite" }}
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="5" stroke="#0F0F0F" strokeWidth="2.2" /><circle cx="8.5" cy="8.5" r="1.7" fill="#0F0F0F" /><circle cx="12" cy="12" r="1.7" fill="#0F0F0F" /><circle cx="15.5" cy="15.5" r="1.7" fill="#0F0F0F" /></svg>
              Kura çek
            </button>
          </>
        ) : (
          <div className="rounded-full px-6 py-[15px] text-center text-[0.92rem]" style={{ background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.08)", color: "var(--text-muted)" }}>
            Aday ekleyebilirsin — kurayı <span className="font-semibold" style={{ color: "var(--text)" }}>{basket.created_by ?? "sepeti açan"}</span> çekecek.
          </div>
        )}
      </div>

      {stageWinner && (
        <RaffleRevealStage
          title={basket.title}
          labels={ideas.map((i) => i.text)}
          winnerLabel={stageWinner.text}
          accent={accent}
          enabled
          confirmLabel="Kazananı onayla"
          onConfirm={() => {
            onWinner(stageWinner);
            setStageWinner(null);
          }}
          onComplete={() => {}}
          onSkip={() => {
            onWinner(stageWinner);
            setStageWinner(null);
          }}
        />
      )}
    </div>
  );
}
