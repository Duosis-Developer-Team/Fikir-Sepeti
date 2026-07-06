"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useNameContext } from "@/components/NameGate";
import { NewBasketModal } from "@/components/NewBasketModal";
import { AnimatedNumber } from "@/components/shared/AnimatedNumber";
import { Avatars } from "@/components/shared/Avatars";
import { createBasket, loadHome } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { accentFor, soft, type Accent } from "@/lib/accent";
import type { Basket, BasketType, Idea, ResolveMethod } from "@/lib/types";

const T = {
  bg: "#1E1E1E",
  card: "#272727",
  black: "#161616",
  text: "#EDEDED",
  t2: "#C4C4C4",
  t3: "#B0B0B0",
  muted: "#9A9A9A",
  faint: "#6E6E6E",
  line: "rgba(255,255,255,0.09)",
  track: "rgba(255,255,255,0.07)",
};

const WORDS = [
  { text: "ne yapalım?", color: "#E7A93F" },
  { text: "nereye gidelim?", color: "#F2795F" },
  { text: "ne yiyelim?", color: "#33C293" },
  { text: "kim kazanır?", color: "#6B8CF0" },
];

function RotatingQuestion() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((v) => (v + 1) % WORDS.length), 2600);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="inline-grid text-left">
      {WORDS.map((w, idx) => {
        const active = i === idx;
        return (
          <span
            key={w.text}
            className="font-display whitespace-nowrap"
            style={{
              gridArea: "1 / 1",
              color: w.color,
              opacity: active ? 1 : 0,
              transform: active ? "translateY(0)" : "translateY(0.42em)",
              transition:
                "opacity 520ms cubic-bezier(.2,.7,.2,1), transform 560ms cubic-bezier(.2,.9,.25,1)",
              pointerEvents: active ? "auto" : "none",
            }}
          >
            {w.text}
          </span>
        );
      })}
    </span>
  );
}

const PHASE_LABEL: Record<string, string> = {
  ideas: "fikir topluyor",
  finalists: "finalist oylaması",
  demos: "demo hazırlığı",
  voting: "oylama · canlı",
  squad: "squad kuruluyor",
  resolved: "sonuçlandı",
};

function authorsOf(basket: Basket, ideas: Idea[]): string[] {
  const s = new Set<string>();
  if (basket.created_by) s.add(basket.created_by);
  for (const i of ideas) if (i.created_by) s.add(i.created_by);
  return [...s];
}

function MiniBars({ ideas, accent }: { ideas: Idea[]; accent: Accent }) {
  const top = [...ideas].sort((a, b) => b.vote_count - a.vote_count).slice(0, 3);
  const max = Math.max(1, ...top.map((i) => i.vote_count));
  if (!top.length) return <p className="text-sm" style={{ color: T.muted }}>henüz fikir yok</p>;
  return (
    <div className="flex flex-col gap-[11px]">
      {top.map((idea, idx) => {
        const pct = (idea.vote_count / max) * 100;
        const lead = idx === 0 && idea.vote_count > 0;
        return (
          <div key={idea.id} className="flex items-center gap-3">
            <span className="shrink-0 truncate text-[0.9rem]" style={{ flexBasis: 96, color: lead ? T.text : T.t3 }}>
              {idea.text}
            </span>
            <span className="h-[7px] flex-1 overflow-hidden rounded-full" style={{ background: T.track }}>
              <span
                className="block h-full rounded-full"
                style={{ width: `${pct}%`, background: lead ? accent.base : soft(accent, 0.3), transition: "width 700ms cubic-bezier(.2,.8,.2,1)" }}
              />
            </span>
            <span className="tnum w-[18px] text-right text-sm font-bold" style={{ color: lead ? accent.base : T.muted }}>
              {idea.vote_count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function RichCard({ basket, ideas }: { basket: Basket; ideas: Idea[] }) {
  const a = accentFor(basket);
  const raffle = basket.resolve_method === "raffle" && basket.type !== "build";
  const total = ideas.reduce((s, i) => s + i.vote_count, 0);
  const authors = authorsOf(basket, ideas);
  const [hover, setHover] = useState(false);
  return (
    <Link
      href={`/basket/${basket.id}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="flex flex-col gap-5 rounded-[22px] p-[26px]"
      style={{
        background: T.card,
        border: `1px solid ${hover ? soft(a, 0.55) : T.line}`,
        transform: hover ? "translateY(-3px)" : "none",
        boxShadow: hover ? `0 24px 50px -30px ${soft(a, 0.6)}` : "none",
        transition: "border-color 240ms ease, transform 240ms ease, box-shadow 240ms ease",
      }}
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-[7px] text-[0.68rem] font-bold uppercase tracking-[0.2em]" style={{ color: a.base }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: a.base }} />
          {basket.type === "build" ? "build" : "sosyal"}
        </span>
        <span className="text-[0.76rem]" style={{ color: T.muted }}>
          {basket.status === "resolved" ? "sonuçlandı" : PHASE_LABEL[basket.phase] ?? basket.phase}
        </span>
      </div>
      <h3 className="font-display text-[1.5rem] font-semibold leading-[1.1]" style={{ color: T.text }}>
        {basket.title}
      </h3>
      <div className="flex-1">
        {raffle ? (
          <div className="flex flex-wrap gap-2">
            {ideas.slice(0, 5).map((i) => (
              <span key={i.id} className="rounded-full px-[13px] py-[7px] text-[0.84rem]" style={{ background: soft(a, 0.13), color: a.light }}>
                {i.text}
              </span>
            ))}
            {!ideas.length && <span className="text-sm" style={{ color: T.muted }}>havuz boş</span>}
          </div>
        ) : (
          <MiniBars ideas={ideas} accent={a} />
        )}
      </div>
      <div className="mt-auto flex items-center justify-between pt-1">
        <Avatars names={authors} ring={T.card} />
        <span className="tnum text-[0.86rem]" style={{ color: T.muted }}>
          {raffle ? `${ideas.length} fikir` : <><span className="font-bold" style={{ color: T.text }}>{total}</span> oy</>}
        </span>
      </div>
    </Link>
  );
}

function Featured({ basket, ideas }: { basket: Basket; ideas: Idea[] }) {
  const a = accentFor(basket);
  const total = ideas.reduce((s, i) => s + i.vote_count, 0);
  const authors = authorsOf(basket, ideas);
  const bars = (() => {
    const f = ideas.filter((i) => i.is_finalist);
    return (f.length ? f : ideas).sort((x, y) => y.vote_count - x.vote_count).slice(0, 3);
  })();
  const max = Math.max(1, ...bars.map((i) => i.vote_count));
  const [hover, setHover] = useState(false);
  return (
    <Link
      href={`/basket/${basket.id}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="mt-[22px] grid gap-8 rounded-[26px] p-[clamp(26px,3vw,38px)] md:grid-cols-[1.05fr_1fr]"
      style={{
        background: T.black,
        border: `1px solid ${soft(a, hover ? 0.55 : 0.22)}`,
        boxShadow: hover ? `0 26px 60px -34px ${soft(a, 0.7)}` : "none",
        transition: "border-color 240ms ease, box-shadow 240ms ease",
      }}
    >
      <div className="flex flex-col justify-between gap-[26px]">
        <div>
          <span className="inline-flex items-center gap-[7px] rounded-full px-[13px] py-[7px] text-[0.68rem] font-bold uppercase tracking-[0.2em]" style={{ background: soft(a, 0.14), color: a.base }}>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: a.base }} />
            şu an canlı
          </span>
          <h2 className="font-display mt-5 text-[clamp(1.9rem,3.4vw,2.9rem)] font-semibold leading-[1.02]" style={{ color: T.text }}>
            {basket.title}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-[18px]">
          <Avatars names={authors} size={30} ring={T.black} />
          <span className="tnum text-[0.92rem]" style={{ color: T.muted }}>
            <span className="font-bold" style={{ color: T.text }}>{total}</span> oy verildi
          </span>
          <span className="ml-auto text-[0.95rem] font-semibold" style={{ color: a.base }}>Oylamaya katıl →</span>
        </div>
      </div>
      <div className="flex flex-col justify-center gap-[18px]">
        {bars.map((idea, idx) => {
          const pct = (idea.vote_count / max) * 100;
          const lead = idx === 0 && idea.vote_count > 0;
          return (
            <div key={idea.id} className="flex items-center gap-[14px]">
              <span className="shrink-0 truncate text-[0.98rem]" style={{ flexBasis: 168, color: lead ? T.text : T.t2 }}>{idea.text}</span>
              <span className="h-[9px] flex-1 overflow-hidden rounded-full" style={{ background: T.track }}>
                <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: lead ? a.base : soft(a, 0.32), transition: "width 800ms cubic-bezier(.2,.8,.2,1)" }} />
              </span>
              <span className="tnum w-[26px] text-right font-bold" style={{ color: lead ? a.base : T.muted }}>{idea.vote_count}</span>
            </div>
          );
        })}
      </div>
    </Link>
  );
}

function Wordmark() {
  return (
    <div className="flex items-center gap-3">
      <span className="inline-flex h-[18px] items-end gap-[2px]">
        <span className="w-1 rounded-[1px]" style={{ height: 9, background: "#F2795F" }} />
        <span className="w-1 rounded-[1px]" style={{ height: 16, background: "#E7A93F" }} />
        <span className="w-1 rounded-[1px]" style={{ height: 12, background: "#33C293" }} />
      </span>
      <span className="text-[0.82rem] font-bold uppercase tracking-[0.22em]" style={{ color: T.text }}>Fikir Sepeti</span>
    </div>
  );
}

export default function Home() {
  const { name } = useNameContext();
  const router = useRouter();
  const [baskets, setBaskets] = useState<Basket[]>([]);
  const [ideasBy, setIdeasBy] = useState<Record<string, Idea[]>>({});
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);

  const refresh = async () => {
    const { baskets, ideasByBasket } = await loadHome();
    setBaskets(baskets);
    setIdeasBy(ideasByBasket);
    setLoading(false);
  };
  useEffect(() => {
    void refresh();
    const ch = supabase
      .channel("home:live")
      .on("postgres_changes", { event: "*", schema: "public", table: "baskets" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "ideas" }, () => void refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const featured = useMemo(() => baskets.find((b) => b.phase === "voting") ?? null, [baskets]);
  const rest = useMemo(() => baskets.filter((b) => b.id !== featured?.id), [baskets, featured]);
  const stats = useMemo(() => ({
    total: baskets.length,
    live: baskets.filter((b) => b.phase === "voting").length,
    votes: Object.values(ideasBy).flat().reduce((s, i) => s + i.vote_count, 0),
  }), [baskets, ideasBy]);

  const onCreate = async (input: { title: string; type: BasketType; resolve_method: ResolveMethod }) => {
    const created = await createBasket({ ...input, created_by: name });
    if (created) router.push(`/basket/${created.id}`);
  };

  return (
    <main className="min-h-screen" style={{ background: T.bg, color: T.text }}>
      <header className="sticky top-0 z-20 flex items-center justify-between px-[clamp(24px,5vw,56px)] py-4" style={{ borderBottom: `1px solid ${T.line}`, background: "rgba(26,28,32,0.82)", backdropFilter: "blur(14px)" }}>
        <Wordmark />
        <div className="flex items-center gap-[18px]">
          {name && (
            <div className="flex items-center gap-[9px]">
              <span className="grid h-7 w-7 place-items-center rounded-full text-[0.78rem] font-bold" style={{ background: "linear-gradient(135deg,#E7A93F,#F2795F)", color: "#161616" }}>
                {name.charAt(0).toLocaleUpperCase("tr")}
              </span>
              <span className="text-[0.92rem]" style={{ color: T.t2 }}>{name}</span>
            </div>
          )}
          <button onClick={() => setModal(true)} className="rounded-full px-[18px] py-[9px] text-[0.9rem] font-semibold transition hover:-translate-y-px" style={{ background: T.text, color: "#161616" }}>
            Yeni sepet
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1180px] px-[clamp(24px,5vw,56px)] pb-[90px]">
        {/* HERO */}
        <section className="pt-[clamp(48px,7vw,84px)]">
          <div className="flex items-center gap-[10px]">
            <span className="h-2 w-2 rounded-full" style={{ background: "#E7A93F", animation: "fs-livedot 2s ease-in-out infinite" }} />
            <span className="text-[0.72rem] font-semibold uppercase tracking-[0.26em]" style={{ color: T.muted }}>Ekip kararları · Canlı</span>
          </div>
          <h1 className="font-display mt-4 flex flex-wrap items-baseline gap-x-[0.28em] font-semibold leading-[1] text-[clamp(2.6rem,7vw,5.2rem)]" style={{ color: T.text }}>
            <span>Bugün</span>
            <RotatingQuestion />
          </h1>
          <div className="mt-[30px] flex flex-wrap items-end justify-between gap-x-12 gap-y-8">
            <p className="max-w-[46ch] text-[1.08rem] leading-[1.55]" style={{ color: T.t3 }}>
              Fikri sepete at — gerisini ekibin <span className="font-semibold" style={{ color: "#F2795F" }}>oyu</span> ya da <span className="font-semibold" style={{ color: "#33C293" }}>kura</span> çözsün. Hackathon için canlı sunum dahil.
            </p>
            <div className="flex gap-10">
              {[
                { v: stats.total, l: "Sepet", c: T.text },
                { v: stats.votes, l: "Oy", c: T.text },
                { v: stats.live, l: "Canlı", c: "#E7A93F" },
              ].map((s) => (
                <div key={s.l}>
                  <div className="font-display tnum text-[2.4rem] font-semibold leading-none" style={{ color: s.c }}>
                    <AnimatedNumber value={s.v} />
                  </div>
                  <div className="mt-1.5 text-[0.7rem] uppercase tracking-[0.16em]" style={{ color: T.muted }}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SEPETLER ayraç */}
        <div className="mt-[52px] flex items-center gap-[18px]">
          <span className="text-[0.72rem] font-semibold uppercase tracking-[0.24em]" style={{ color: T.muted }}>Sepetler</span>
          <span className="h-px flex-1" style={{ background: "rgba(255,255,255,0.10)" }} />
          <span className="tnum text-[0.82rem]" style={{ color: T.faint }}>{baskets.length}</span>
        </div>

        {loading ? (
          <div className="mt-[22px] grid gap-5 md:grid-cols-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-52 animate-pulse rounded-[22px]" style={{ background: T.card }} />)}
          </div>
        ) : baskets.length === 0 ? (
          <div className="mt-[22px] rounded-[22px] py-20 text-center" style={{ background: T.card }}>
            <p style={{ color: T.muted }}>Henüz sepet yok.</p>
            <button onClick={() => setModal(true)} className="mt-3 font-display text-2xl font-semibold" style={{ color: "#F2795F" }}>İlk sepeti aç →</button>
          </div>
        ) : (
          <>
            {featured && <Featured basket={featured} ideas={ideasBy[featured.id] ?? []} />}
            <div className="mt-5 grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
              {rest.map((b) => <RichCard key={b.id} basket={b} ideas={ideasBy[b.id] ?? []} />)}
            </div>
          </>
        )}
      </div>

      <NewBasketModal open={modal} onClose={() => setModal(false)} onCreate={onCreate} />
    </main>
  );
}
