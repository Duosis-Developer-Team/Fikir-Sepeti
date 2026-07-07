"use client";

import { useEffect, useState } from "react";
import { setBasketPhase } from "@/lib/db";
import type { StageContext } from "../contract";
import { GOLD, dim } from "../contract";
import { GoldButton, StageHeadline } from "../ui";

export function HackathonStage({ data, isAdmin, refresh }: StageContext) {
  const { basket } = data;
  const endsAt = basket.hackathon_ends_at ? new Date(basket.hackathon_ends_at).getTime() : null;
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const remain = endsAt && now ? Math.max(0, endsAt - now) : 0;
  const sec = Math.floor(remain / 1000);
  const hh = Math.floor(sec / 3600);
  const mm = Math.floor((sec % 3600) / 60);
  const ss = sec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const over = endsAt !== null && now !== null && remain <= 0;

  const finish = () => setBasketPhase(basket.id, "demo").then(refresh);
  const back = () => setBasketPhase(basket.id, "team").then(refresh);

  return (
    <div className="mx-auto flex min-h-[58vh] max-w-[960px] flex-col items-center justify-center text-center">
      <StageHeadline
        pre="Hackathon"
        accent="başladı"
        sub={over ? "Süre doldu — demoya geçin." : "Takımlar yapıyor. Kalan süre:"}
      />

      <div
        className="font-display font-extrabold tabular-nums tracking-tight"
        style={{ fontSize: "clamp(4rem,13vw,11rem)", lineHeight: 0.95, color: over ? "#F2795F" : GOLD, textShadow: over ? "none" : "0 0 60px rgba(231,169,63,0.25)" }}
      >
        {now === null ? "--:--:--" : `${pad(hh)}:${pad(mm)}:${pad(ss)}`}
      </div>

      {isAdmin && (
        <div className="mt-12 flex items-center justify-center gap-3">
          <button onClick={back} className="rounded-full border px-6 py-3 text-[0.95rem] transition hover:bg-[rgba(var(--border-rgb),0.08)]" style={{ borderColor: "rgba(var(--border-rgb),0.2)", color: dim(0.85) }}>← Takım</button>
          <GoldButton onClick={finish}>Hackathon&apos;u bitir → Demo</GoldButton>
        </div>
      )}
      {!isAdmin && <p className="mt-8 text-[0.95rem]" style={{ color: dim(0.45) }}>Sunan bitirince demoya geçilecek.</p>}
    </div>
  );
}
