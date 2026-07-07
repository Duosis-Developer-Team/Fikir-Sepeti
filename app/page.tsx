"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useNameContext } from "@/components/AuthGate";
import { NewBasketModal } from "@/components/NewBasketModal";
import { Avatars } from "@/components/shared/Avatars";
import { createBasket, loadHome } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { accentFor, soft, type Accent } from "@/lib/accent";
import type { Basket, BasketType, Idea, ResolveMethod } from "@/lib/types";

const T = {
  bg: "#181818",
  card: "#242424",
  black: "#0F0F0F",
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
  const prev = (i - 1 + WORDS.length) % WORDS.length;
  return (
    // sabit genişlik (en uzun kelime) + overflow-hidden → temiz dikey roll, çakışma yok
    <span className="relative inline-block overflow-hidden align-bottom" style={{ height: "1.1em" }}>
      <span className="invisible whitespace-nowrap px-[0.04em]" aria-hidden>nereye gidelim?</span>
      {WORDS.map((w, idx) => {
        const y = idx === i ? "0%" : idx === prev ? "-110%" : "110%";
        return (
          <span
            key={w.text}
            className="font-display absolute inset-0 flex items-center justify-center whitespace-nowrap"
            style={{
              color: w.color,
              transform: `translateY(${y})`,
              opacity: idx === i ? 1 : 0,
              transition: "transform 560ms cubic-bezier(.2,.85,.25,1), opacity 260ms ease",
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

// Canlı = build oylama fazında VEYA sosyal oylama (aktif, oy almış).
function isLiveBasket(b: Basket, ideas: Idea[]): boolean {
  if (b.status === "resolved") return false;
  if (b.type === "hackathon") return b.phase === "demo";
  return b.resolve_method === "vote" && ideas.reduce((s, i) => s + i.vote_count, 0) > 0;
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
  const raffle = basket.resolve_method === "raffle" && basket.type !== "hackathon";
  const total = ideas.reduce((s, i) => s + i.vote_count, 0);
  const authors = authorsOf(basket, ideas);
  const live = isLiveBasket(basket, ideas);
  const [hover, setHover] = useState(false);
  const status = basket.status === "resolved"
    ? "sonuçlandı"
    : live
      ? "canlı oylama"
      : raffle
        ? "kura havuzu"
        : PHASE_LABEL[basket.phase] ?? basket.phase;
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
          {basket.type === "hackathon" ? "hackathon" : "etkinlik"}
        </span>
        <span className="flex items-center gap-1.5 text-[0.76rem]" style={{ color: live ? a.base : T.muted }}>
          {live && <span className="h-1.5 w-1.5 rounded-full" style={{ background: a.base, animation: "fs-livedot 2s ease-in-out infinite" }} />}
          {status}
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
      className="block rounded-[26px] p-[clamp(26px,3vw,38px)]"
      style={{
        background: T.black,
        border: `1px solid ${soft(a, hover ? 0.55 : 0.22)}`,
        boxShadow: hover ? `0 26px 60px -34px ${soft(a, 0.7)}` : "none",
        transition: "border-color 240ms ease, box-shadow 240ms ease",
      }}
    >
      <div className="grid gap-8 md:grid-cols-[1.05fr_1fr]">
        <div>
          <span className="inline-flex items-center gap-[7px] rounded-full px-[13px] py-[7px] text-[0.68rem] font-bold uppercase tracking-[0.2em]" style={{ background: soft(a, 0.14), color: a.base }}>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: a.base }} />
            şu an canlı
          </span>
          <h2 className="font-display mt-5 text-[clamp(1.9rem,3.4vw,2.9rem)] font-semibold leading-[1.02]" style={{ color: T.text }}>
            {basket.title}
          </h2>
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
      </div>

      {/* footer — tam genişlik, CTA sağ-alt */}
      <div className="mt-7 flex items-center justify-between gap-4 border-t pt-5" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-[14px]">
          <Avatars names={authors} size={30} ring={T.black} />
          <span className="tnum text-[0.92rem]" style={{ color: T.muted }}>
            <span className="font-bold" style={{ color: T.text }}>{total}</span> oy verildi
          </span>
        </div>
        <span className="text-[0.95rem] font-semibold" style={{ color: a.base }}>Oylamaya katıl →</span>
      </div>
    </Link>
  );
}

function Wordmark() {
  return (
    <Link href="/" className="flex shrink-0 items-center" aria-label="FikirSepeti ana sayfa">
      <Image
        src="/brand/fikirsepeti-logo.png"
        alt="FikirSepeti"
        width={958}
        height={220}
        priority
        className="h-8 w-auto object-contain sm:h-9"
      />
    </Link>
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

  const [tab, setTab] = useState<"aktif" | "gecmis">("aktif");
  const resolved = useMemo(() => baskets.filter((b) => b.status === "resolved"), [baskets]);
  const active = useMemo(() => baskets.filter((b) => b.status !== "resolved"), [baskets]);
  const live = useMemo(() => active.filter((b) => isLiveBasket(b, ideasBy[b.id] ?? [])), [active, ideasBy]);
  const activeRest = useMemo(() => active.filter((b) => !isLiveBasket(b, ideasBy[b.id] ?? [])), [active, ideasBy]);

  const onCreate = async (input: { title: string; type: BasketType; resolve_method: ResolveMethod }) => {
    const created = await createBasket({ ...input, created_by: name });
    if (created) router.push(`/basket/${created.id}`);
  };

  return (
    <main className="relative z-[1] min-h-screen" style={{ color: T.text }}>
      <header className="sticky top-0 z-20 flex items-center justify-between px-[clamp(24px,5vw,56px)] py-[14px]" style={{ borderBottom: `1px solid ${T.line}`, background: T.bg }}>
        <Wordmark />
        {/* Yeni sepet — ortada */}
        <button onClick={() => setModal(true)} className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1.5 rounded-full px-[18px] py-[10px] text-[0.9rem] font-semibold transition hover:-translate-y-px sm:inline-flex" style={{ background: T.text, color: "#0F0F0F" }}>
          <span className="text-[1.05rem] leading-none">+</span> Yeni sepet
        </button>
        {/* profil — en sağ */}
        <div className="flex items-center gap-3">
          <button onClick={() => setModal(true)} className="inline-flex items-center gap-1 rounded-full px-4 py-2 text-[0.9rem] font-semibold sm:hidden" style={{ background: T.text, color: "#0F0F0F" }}>+ Yeni</button>
          {name && (
            <Link href="/profil" className="flex items-center gap-[9px] rounded-full border py-1 pl-1 pr-[14px] transition hover:border-[rgba(255,255,255,0.2)]" style={{ borderColor: T.line, background: T.card }}>
              <span className="grid h-7 w-7 place-items-center rounded-full text-[0.78rem] font-bold" style={{ background: "linear-gradient(135deg,#E7A93F,#F2795F)", color: "#0F0F0F" }}>
                {name.charAt(0).toLocaleUpperCase("tr")}
              </span>
              <span className="text-[0.9rem]" style={{ color: T.t2 }}>{name}</span>
            </Link>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-[1180px] px-[clamp(24px,5vw,56px)] pb-[90px]">
        {/* HERO — ortalı, iki satır (Bugün üstte, dönen kelime altta) */}
        <section className="pt-[clamp(52px,8vw,96px)] text-center">
          <h1 className="font-display flex flex-col items-center font-semibold leading-[1.04] tracking-tight text-[clamp(2.8rem,7.5vw,5.4rem)]" style={{ color: T.text }}>
            <span>Bugün</span>
            <RotatingQuestion />
          </h1>
          <p className="mx-auto mt-8 max-w-[52ch] text-[1.08rem] leading-[1.55]" style={{ color: T.t3 }}>
            Fikri sepete at — gerisini ekibin <span className="font-semibold" style={{ color: "#F2795F" }}>oyu</span> ya da <span className="font-semibold" style={{ color: "#33C293" }}>kura</span> çözsün. Hackathon için canlı sunum dahil.
          </p>
        </section>

        {/* sekmeler — segmented pill, ortalı */}
        <div className="mt-[52px] flex justify-center">
        <div className="inline-flex gap-1 rounded-full p-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {([["aktif", "Aktif", active.length], ["gecmis", "Geçmiş", resolved.length]] as const).map(([key, label, count]) => {
            const on = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="flex items-center gap-2 rounded-full px-[18px] py-[9px] text-[0.9rem] font-semibold transition"
                style={{ background: on ? T.card : "transparent", color: on ? T.text : T.muted, boxShadow: on ? "0 2px 8px -4px rgba(0,0,0,0.6)" : "none" }}
              >
                {label}
                <span className="tnum rounded-full px-[7px] py-0.5 text-[0.7rem]" style={{ background: on ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)", color: on ? T.t3 : T.faint }}>{count}</span>
              </button>
            );
          })}
        </div>
        </div>

        {loading ? (
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-52 animate-pulse rounded-[22px]" style={{ background: T.card }} />)}
          </div>
        ) : baskets.length === 0 ? (
          <div className="mt-6 rounded-[22px] py-20 text-center" style={{ background: T.card }}>
            <p style={{ color: T.muted }}>Henüz sepet yok.</p>
            <button onClick={() => setModal(true)} className="mt-3 font-display text-2xl font-semibold" style={{ color: "#F2795F" }}>İlk sepeti aç →</button>
          </div>
        ) : tab === "aktif" ? (
          <div className="mt-6 flex flex-col gap-5">
            {live.map((b) => <Featured key={b.id} basket={b} ideas={ideasBy[b.id] ?? []} />)}
            {activeRest.length > 0 && (
              <div className="grid gap-5 md:grid-cols-2">
                {activeRest.map((b) => <RichCard key={b.id} basket={b} ideas={ideasBy[b.id] ?? []} />)}
              </div>
            )}
          </div>
        ) : resolved.length === 0 ? (
          <div className="mt-6 rounded-[22px] py-16 text-center" style={{ background: T.card }}>
            <p style={{ color: T.muted }}>Henüz sonuçlanan karar yok.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {resolved.map((b) => <RichCard key={b.id} basket={b} ideas={ideasBy[b.id] ?? []} />)}
          </div>
        )}
      </div>

      <NewBasketModal open={modal} onClose={() => setModal(false)} onCreate={onCreate} />
    </main>
  );
}
