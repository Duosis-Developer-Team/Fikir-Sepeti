"use client";

import { useEffect, useRef, useState } from "react";
import { addIdea, deleteIdea } from "@/lib/db";
import { soft, type Accent } from "@/lib/accent";
import type { Basket, Idea } from "@/lib/types";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** İMZA — Kura Reveal (Design system documentation). */
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
  const [phase, setPhase] = useState<"idle" | "rolling" | "revealed">("idle");
  const [name, setName] = useState("");
  const [draft, setDraft] = useState("");
  const rollT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const winnerRef = useRef<Idea | null>(null);

  useEffect(() => () => { if (rollT.current) clearTimeout(rollT.current); }, []);

  const reduced = () =>
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const add = async () => {
    const v = draft.trim();
    if (v.length < 2) return;
    setDraft("");
    await addIdea({ basket_id: basket.id, text: v, created_by: voter });
  };

  const showStage = phase !== "idle";
  const revealed = phase === "revealed";

  const pull = async () => {
    if (phase === "rolling" || ideas.length < 2) return;
    const winner = ideas[Math.floor(Math.random() * ideas.length)];
    winnerRef.current = winner;

    if (reduced()) {
      setName(winner.text);
      setPhase("revealed");
      return;
    }
    setPhase("rolling");
    let i = 1;
    let delay = 60;
    const roll = async () => {
      setName(ideas[i % ideas.length].text);
      i++;
      delay *= 1.15;
      if (delay < 330) {
        rollT.current = setTimeout(roll, delay);
      } else {
        rollT.current = setTimeout(() => {
          setName(winner.text);
          setPhase("revealed");
        }, delay);
      }
    };
    setName(ideas[0].text);
    await wait(60);
    roll();
  };

  const close = () => {
    if (rollT.current) clearTimeout(rollT.current);
    setPhase("idle");
    setName("");
  };
  const again = async () => {
    setPhase("idle");
    setName("");
    await wait(60);
    pull();
  };
  const finish = () => winnerRef.current && onWinner(winnerRef.current);

  const chrome = { opacity: showStage ? 0.28 : 1, transition: "opacity 400ms ease" };

  return (
    <div>
      {/* aday ekle */}
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

      {/* SAHNE */}
      {showStage && (
        <div className="fixed inset-0 z-50 overflow-hidden" style={{ background: "#0F0F0F" }}>
          <div className="pointer-events-none absolute inset-0 z-[1]" style={{ background: "radial-gradient(120% 90% at 50% 42%, transparent 40%, rgba(0,0,0,0.6) 100%)" }} />
          {/* bloom */}
          <div
            className="pointer-events-none absolute z-[2]"
            style={{
              left: "50%", bottom: "-8%", width: "90vw", maxWidth: 1100, height: "80vh",
              transform: `translateX(-50%) scale(${revealed ? 1 : 0.7})`,
              background: `radial-gradient(50% 55% at 50% 60%, ${soft(accent, 0.5)} 0%, ${soft(accent, 0.14)} 42%, transparent 70%)`,
              filter: "blur(18px)", opacity: revealed ? 1 : 0,
              transition: "opacity 620ms ease, transform 720ms cubic-bezier(.16,1.05,.3,1)",
            }}
          />
          <button onClick={close} className="absolute right-[30px] top-[28px] z-[8] rounded-full px-4 py-[9px] text-[0.9rem]" style={{ ...chrome, background: "rgba(var(--border-rgb),0.06)", color: "var(--text-muted)" }}>Kapat ✕</button>

          <div className="relative z-[3] flex h-full flex-col px-[clamp(24px,5vw,72px)] pb-14 pt-10">
            <div className="flex items-center gap-[10px]" style={chrome}>
              <span className="h-2 w-2 rounded-full" style={{ background: accent.base }} />
              <span className="text-[0.72rem] font-semibold uppercase tracking-[0.26em]" style={{ color: accent.base }}>Kura çekiliyor</span>
            </div>
            <h2 className="font-display mt-3 max-w-[16ch] text-[clamp(1.6rem,3.4vw,2.6rem)] font-semibold leading-[1.05]" style={{ ...chrome, color: "var(--text)" }}>{basket.title}</h2>

            <div className="flex flex-1 flex-col items-center justify-center gap-[18px] text-center">
              <span className="text-[0.82rem] font-semibold uppercase tracking-[0.34em]" style={{ color: accent.base, opacity: revealed ? 1 : 0, transition: "opacity 500ms ease 240ms" }}>Kazanan</span>
              <div
                className="font-display"
                style={{
                  fontWeight: 700, letterSpacing: "-0.035em", lineHeight: 0.95, fontSize: "clamp(3rem,11vw,9rem)",
                  color: revealed ? accent.base : "#7A7A7A",
                  transform: revealed ? "scale(1)" : "scale(0.9)",
                  textShadow: revealed ? `0 20px 80px ${soft(accent, 0.35)}` : "none",
                  transition: "color 220ms ease, transform 520ms cubic-bezier(.16,1.1,.3,1)",
                }}
              >
                {name}
              </div>
              <span className="text-[1.05rem]" style={{ color: "var(--text-muted)", opacity: revealed ? 1 : 0, transition: "opacity 600ms ease 340ms" }}>{ideas.length} aday arasından çekildi</span>
              <div className="mt-3 flex gap-3" style={{ opacity: revealed ? 1 : 0, transition: "opacity 500ms ease 440ms" }}>
                <button onClick={again} className="rounded-full px-[26px] py-3 text-[0.95rem] font-semibold transition" style={{ border: `1px solid ${soft(accent, 0.4)}`, background: "transparent", color: accent.base }}>Tekrar çek</button>
                <button onClick={finish} className="rounded-full px-[26px] py-3 text-[0.95rem] font-bold" style={{ background: accent.base, color: "#0F0F0F" }}>Kazananı onayla</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
