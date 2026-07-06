"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { useNameContext } from "@/components/NameGate";
import { BasketCard } from "@/components/BasketCard";
import { NewBasketModal } from "@/components/NewBasketModal";
import { createBasket, listBaskets } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import type { Basket, BasketType, ResolveMethod } from "@/lib/types";

export default function Home() {
  const { name } = useNameContext();
  const router = useRouter();
  const [baskets, setBaskets] = useState<Basket[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  const refresh = async () => {
    setBaskets(await listBaskets());
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
    // yeni sepetler canlı görünsün
    const channel = supabase
      .channel("baskets:list")
      .on("postgres_changes", { event: "*", schema: "public", table: "baskets" }, () => {
        void refresh();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const onCreate = async (input: {
    title: string;
    type: BasketType;
    resolve_method: ResolveMethod;
  }) => {
    const created = await createBasket({ ...input, created_by: name });
    if (created) router.push(`/basket/${created.id}`);
  };

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-medium">Fikir Sepeti</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Merhaba {name || "…"}</p>
        </div>
        <button
          onClick={() => setModal(true)}
          className="rounded-lg bg-[var(--text)] px-4 py-2.5 text-sm font-medium text-white"
        >
          Yeni sepet
        </button>
      </header>

      <section className="mt-8">
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)]"
              />
            ))}
          </div>
        ) : baskets.length === 0 ? (
          <div className="rounded-[var(--radius)] border border-dashed border-[var(--border)] py-16 text-center">
            <p className="text-sm text-[var(--text-muted)]">Henüz sepet yok. İlkini oluştur.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <AnimatePresence>
              {baskets.map((b) => (
                <BasketCard key={b.id} basket={b} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      <NewBasketModal open={modal} onClose={() => setModal(false)} onCreate={onCreate} />
    </main>
  );
}
