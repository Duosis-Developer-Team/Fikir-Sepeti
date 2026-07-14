"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useNameContext, useSession } from "@/components/AuthGate";
import { BrandIcon } from "@/components/BrandIcon";
import { Avatars } from "@/components/shared/Avatars";
import { loadHome } from "@/lib/db";
import { accentFor, soft } from "@/lib/accent";
import { supabase } from "@/lib/supabase";
import type { Basket, Idea } from "@/lib/types";

const PHASE_LABEL: Record<string, string> = {
  ideas: "fikir topluyor",
  lobby: "lobide bekliyor",
  idea: "fikir belirleniyor",
  team: "takımlar kuruluyor",
  demo: "canlı demo",
  feedback: "geri bildirim",
  production: "üretimde",
  done: "tamamlandı",
  resolved: "sonuçlandı",
};

function MineCard({ basket, ideas }: { basket: Basket; ideas: Idea[] }) {
  const a = accentFor(basket);
  const raffle = basket.resolve_method === "raffle" && basket.type !== "hackathon";
  const total = ideas.reduce((s, i) => s + i.vote_count, 0);
  const resolved = basket.status === "resolved";
  const status = resolved ? "sonuçlandı" : raffle ? "kura havuzu" : PHASE_LABEL[basket.phase] ?? basket.phase;
  const [hover, setHover] = useState(false);
  return (
    <Link
      href={`/basket/${basket.id}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="flex flex-col gap-4 rounded-[22px] p-6 transition"
      style={{ background: "var(--card)", border: `1px solid ${hover ? soft(a, 0.5) : "rgba(var(--border-rgb),0.09)"}`, transform: hover ? "translateY(-3px)" : "none" }}
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-[7px] text-[0.68rem] font-bold uppercase tracking-[0.2em]" style={{ color: a.base }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: a.base }} />
          {basket.type === "hackathon" ? "hackathon" : "etkinlik"}
        </span>
        <span className="text-[0.76rem]" style={{ color: "var(--text-muted)" }}>{status}</span>
      </div>
      <h3 className="font-display text-[1.4rem] font-semibold leading-[1.15]" style={{ color: "var(--text)" }}>{basket.title}</h3>
      <div className="mt-auto flex items-center justify-between pt-2">
        <Avatars names={[basket.created_by ?? "", ...ideas.map((i) => i.created_by ?? "")]} ring="var(--card)" />
        <span className="tnum text-[0.86rem]" style={{ color: "var(--text-muted)" }}>
          {raffle ? `${ideas.length} aday` : <><span className="font-bold" style={{ color: "var(--text)" }}>{total}</span> oy</>}
        </span>
      </div>
    </Link>
  );
}

export default function ProfilePage() {
  const { name, tenantId } = useNameContext();
  const { signOut } = useSession();
  const [baskets, setBaskets] = useState<Basket[]>([]);
  const [ideasBy, setIdeasBy] = useState<Record<string, Idea[]>>({});
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!tenantId) {
      setBaskets([]);
      setIdeasBy({});
      setLoading(false);
      return;
    }
    const { baskets, ideasByBasket } = await loadHome(tenantId);
    setBaskets(baskets);
    setIdeasBy(ideasByBasket);
    setLoading(false);
  };
  useEffect(() => {
    void refresh();
    if (!tenantId) return;
    const ch = supabase
      .channel("profil:live")
      .on("postgres_changes", { event: "*", schema: "public", table: "baskets" }, () => void refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const mine = useMemo(() => baskets.filter((b) => b.created_by && b.created_by === name), [baskets, name]);
  const openCount = mine.filter((b) => b.status !== "resolved").length;

  return (
    <main className="mx-auto max-w-[980px] px-[clamp(24px,5vw,40px)] pb-[90px] pt-[clamp(32px,5vw,56px)]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 place-items-center rounded-2xl text-[1.4rem] font-bold" style={{ background: "linear-gradient(135deg,#E7A93F,#F2795F)", color: "#0F0F0F" }}>
            {(name || "?").charAt(0).toLocaleUpperCase("tr")}
          </span>
          <div>
            <h1 className="font-display text-[2rem] font-bold leading-none" style={{ color: "var(--text)" }}>{name || "…"}</h1>
            <p className="mt-1.5 text-[0.92rem]" style={{ color: "var(--text-muted)" }}>
              <span className="font-semibold" style={{ color: "var(--text)" }}>{mine.length}</span> sepet açtın · <span className="font-semibold" style={{ color: "var(--text)" }}>{openCount}</span> aktif
            </p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-[0.9rem] font-semibold transition hover:border-[rgba(242,121,95,0.5)]"
          style={{ borderColor: "rgba(var(--border-rgb),0.14)", color: "var(--text-2)" }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>
          Çıkış yap
        </button>
      </div>

      <div className="mt-9 flex items-center gap-4">
        <span className="text-[0.72rem] font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--text-muted)" }}>Sepetlerim</span>
        <span className="h-px flex-1" style={{ background: "rgba(var(--border-rgb),0.1)" }} />
      </div>

      {loading ? (
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {[0, 1].map((i) => <div key={i} className="h-40 animate-pulse rounded-[22px]" style={{ background: "var(--card)" }} />)}
        </div>
      ) : mine.length === 0 ? (
        <div className="mt-6 rounded-[22px] py-16 text-center" style={{ background: "var(--card)" }}>
          <BrandIcon size="md" className="mb-4 inline-block opacity-90" />
          <p style={{ color: "var(--text-muted)" }}>Henüz sepet açmadın.</p>
          <Link href="/" className="mt-3 inline-block font-display text-xl font-semibold" style={{ color: "#F2795F" }}>İlk sepetini aç →</Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {mine.map((b) => <MineCard key={b.id} basket={b} ideas={ideasBy[b.id] ?? []} />)}
        </div>
      )}
    </main>
  );
}
