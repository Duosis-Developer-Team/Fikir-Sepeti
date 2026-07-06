"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useNameContext } from "@/components/NameGate";
import { SocialBasket } from "@/components/social/SocialBasket";
import { BuildBasket } from "@/components/build/BuildBasket";
import { supabase } from "@/lib/supabase";
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

  return (
    <main className="mx-auto max-w-2xl px-5 py-6">
      <Link href="/" className="text-sm text-[var(--text-muted)] transition hover:text-[var(--text)]">
        ← sepetler
      </Link>

      <h1 className="mt-3 text-xl font-medium">{basket?.title ?? "…"}</h1>

      <div className="mt-6">
        {notFound ? (
          <p className="text-sm text-[var(--text-muted)]">Sepet bulunamadı.</p>
        ) : !basket ? (
          <div className="mx-auto max-w-md space-y-2.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)]"
              />
            ))}
          </div>
        ) : basket.type === "build" ? (
          <BuildBasket basket={basket} voter={name} />
        ) : (
          <SocialBasket basket={basket} voter={name} />
        )}
      </div>
    </main>
  );
}
