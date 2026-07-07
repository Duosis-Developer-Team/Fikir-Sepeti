"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useNameContext } from "@/components/AuthGate";
import { SocialBasket } from "@/components/social/SocialBasket";
import { HackathonRunner } from "@/components/hackathon/HackathonRunner";
import { supabase } from "@/lib/supabase";
import { accentFor } from "@/lib/accent";
import type { Basket } from "@/lib/types";

export default function BasketDetail() {
  const { id } = useParams<{ id: string }>();
  const { name } = useNameContext();
  const [basket, setBasket] = useState<Basket | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("baskets").select("*").eq("id", id).single();
      if (data) setBasket(data as Basket);
      else setNotFound(true);
    })();
  }, [id]);

  const a = basket ? accentFor(basket) : null;
  const isHackathon = basket?.type === "hackathon";
  const eyebrow = basket
    ? isHackathon
      ? "Hackathon"
      : basket.resolve_method === "raffle"
        ? "Etkinlik · Kura"
        : "Etkinlik · Oylama"
    : "";

  const maxW = isHackathon ? "max-w-[1280px]" : "max-w-[880px]";

  return (
    <main className={`mx-auto ${maxW} px-[clamp(24px,5vw,40px)] pb-[90px] pt-[clamp(28px,4vw,48px)]`}>
      <div className="flex justify-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-[rgba(var(--border-rgb),0.09)] bg-[var(--card)] px-4 py-2 text-[0.88rem] text-[var(--text-3)] transition hover:border-[rgba(var(--border-rgb),0.2)] hover:text-[var(--text)]"
        >
          <span className="text-base leading-none">←</span> sepetler
        </Link>
      </div>

      {basket && a && (
        isHackathon ? (
          <div className="mt-7 flex items-center justify-center gap-2.5">
            <span className="h-[7px] w-[7px] rounded-full" style={{ background: a.base, boxShadow: `0 0 0 4px ${a.base}22` }} />
            <span className="text-[0.74rem] font-bold uppercase tracking-[0.22em]" style={{ color: a.base }}>Hackathon</span>
            <span className="text-[0.74rem] font-semibold" style={{ color: "var(--text-muted)" }}>· {basket.title}</span>
          </div>
        ) : (
          <div className="mt-8 text-center">
            <div className="flex items-center justify-center gap-[9px]">
              <span className="h-[7px] w-[7px] rounded-full" style={{ background: a.base, boxShadow: `0 0 0 4px ${a.base}22` }} />
              <span className="text-[0.72rem] font-bold uppercase tracking-[0.22em]" style={{ color: a.base }}>{eyebrow}</span>
            </div>
            <h1 className="font-display mt-3 text-[clamp(2.2rem,5vw,3.5rem)] font-semibold leading-[1.02]" style={{ color: "var(--text)" }}>
              {basket.title}
            </h1>
          </div>
        )
      )}

      <div className="mt-8">
        {notFound ? (
          <p className="text-center text-sm" style={{ color: "var(--text-muted)" }}>Sepet bulunamadı.</p>
        ) : !basket || !a ? (
          <div className="mx-auto flex max-w-[760px] flex-col gap-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-[18px]" style={{ background: "var(--card)" }} />)}
          </div>
        ) : isHackathon ? (
          <HackathonRunner basketId={basket.id} />
        ) : (
          <SocialBasket basket={basket} voter={name} accent={a} />
        )}
      </div>
    </main>
  );
}
