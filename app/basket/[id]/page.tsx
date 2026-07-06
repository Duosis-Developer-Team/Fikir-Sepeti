"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useNameContext } from "@/components/NameGate";
import { SocialBasket } from "@/components/social/SocialBasket";
import { BuildBasket } from "@/components/build/BuildBasket";
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
  const eyebrow = basket
    ? basket.type === "build"
      ? "Build · İç Hackathon"
      : basket.resolve_method === "raffle"
        ? "Sosyal · Kura"
        : "Sosyal · Oylama"
    : "";

  return (
    <main className="mx-auto max-w-[880px] px-[clamp(24px,5vw,40px)] pb-[90px] pt-[clamp(32px,5vw,56px)]">
      <Link href="/" className="text-[0.95rem]" style={{ color: "#9A9A9A" }}>← sepetler</Link>

      {basket && a && (
        <>
          <div className="mt-[30px] flex items-center gap-[9px]">
            <span className="h-[7px] w-[7px] rounded-full" style={{ background: a.base }} />
            <span className="text-[0.72rem] font-bold uppercase tracking-[0.22em]" style={{ color: a.base }}>{eyebrow}</span>
          </div>
          <h1 className="font-display mt-[14px] text-[clamp(2.2rem,5vw,3.5rem)] font-semibold leading-[1]" style={{ color: "#EDEDED" }}>
            {basket.title}
          </h1>
        </>
      )}

      <div className="mt-7">
        {notFound ? (
          <p className="text-sm" style={{ color: "#9A9A9A" }}>Sepet bulunamadı.</p>
        ) : !basket || !a ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-[18px]" style={{ background: "#272727" }} />)}
          </div>
        ) : basket.type === "build" ? (
          <BuildBasket basket={basket} voter={name} accent={a} />
        ) : (
          <SocialBasket basket={basket} voter={name} accent={a} />
        )}
      </div>
    </main>
  );
}
