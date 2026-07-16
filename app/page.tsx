"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useNameContext, useSession } from "@/components/AuthGate";
import { BrandIcon } from "@/components/BrandIcon";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NewBasketModal } from "@/components/NewBasketModal";
import { PoolPanel } from "@/components/pool/PoolPanel";
import { LandingPage } from "@/components/LandingPage";
import { Avatars } from "@/components/shared/Avatars";
import { createBasket, loadHome } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { accentFor, soft, type Accent } from "@/lib/accent";
import type { Basket, BasketType, Idea, ResolveMethod } from "@/lib/types";

type ModeTab = "kavanoz" | "hackathon" | "etkinlik";

const T = {
  bg: "var(--bg)",
  card: "var(--card)",
  black: "var(--black)",
  text: "var(--text)",
  t2: "var(--text-2)",
  t3: "var(--text-3)",
  muted: "var(--text-muted)",
  faint: "var(--text-faint)",
  line: "rgba(var(--border-rgb),0.09)",
  track: "rgba(var(--border-rgb),0.07)",
};

// editorial ease — yumuşak, kendinden emin çıkış
const EASE = [0.16, 1, 0.3, 1] as const;

/** Maskeli satır-reveal — editorial giriş. */
function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <span className="block overflow-hidden pb-[0.08em]">
      <motion.span className="block" initial={{ y: "118%" }} animate={{ y: 0 }} transition={{ duration: 0.95, ease: EASE, delay }}>
        {children}
      </motion.span>
    </span>
  );
}

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
      className="grain relative flex flex-col gap-6 overflow-hidden rounded-[26px] p-[34px]"
      style={{
        background: "linear-gradient(180deg, var(--sheen), transparent 46%), var(--card)",
        border: `1px solid ${hover ? soft(a, 0.55) : T.line}`,
        transform: hover ? "translateY(-4px)" : "none",
        boxShadow: hover
          ? `var(--card-shadow-hover), 0 34px 72px -36px ${soft(a, 0.55)}, inset 0 1px 0 var(--edge)`
          : "var(--card-shadow), inset 0 1px 0 var(--edge)",
        transition: "border-color 300ms ease, transform 300ms cubic-bezier(.16,1,.3,1), box-shadow 300ms ease",
      }}
    >
      {/* aksan köşe glow'u — kartın kimliği */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full blur-[50px]"
        style={{ background: soft(a, hover ? 0.24 : 0.15), transition: "background 300ms ease" }}
      />
      <div className="relative flex items-center justify-between">
        <span className="inline-flex items-center gap-[7px] text-[0.72rem] font-bold uppercase tracking-[0.2em]" style={{ color: a.base }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: a.base }} />
          {basket.type === "hackathon" ? "hackathon" : "etkinlik"}
        </span>
        <span className="flex items-center gap-1.5 text-[0.8rem]" style={{ color: live ? a.base : T.muted }}>
          {live && <span className="h-1.5 w-1.5 rounded-full" style={{ background: a.base, animation: "fs-livedot 2s ease-in-out infinite" }} />}
          {status}
        </span>
      </div>
      <h3 className="font-display relative text-[2rem] font-bold leading-[1.08] tracking-tight" style={{ color: T.text }}>
        {basket.title}
      </h3>
      <div className="relative flex-1">
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
      <div className="relative mt-auto flex items-center justify-between pt-1">
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
      className="grain relative block overflow-hidden rounded-[28px] p-[clamp(28px,3.2vw,44px)]"
      style={{
        background: "linear-gradient(180deg, var(--sheen), transparent 46%), var(--black)",
        border: `1px solid ${soft(a, hover ? 0.55 : 0.22)}`,
        transform: hover ? "translateY(-4px)" : "none",
        boxShadow: hover
          ? `var(--card-shadow-hover), 0 40px 80px -36px ${soft(a, 0.6)}, inset 0 1px 0 var(--edge)`
          : "var(--card-shadow), inset 0 1px 0 var(--edge)",
        transition: "border-color 300ms ease, transform 300ms cubic-bezier(.16,1,.3,1), box-shadow 300ms ease",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full blur-[64px]"
        style={{ background: soft(a, hover ? 0.26 : 0.18), transition: "background 300ms ease" }}
      />
      <div className="relative grid gap-8 md:grid-cols-[1.05fr_1fr]">
        <div>
          <span className="inline-flex items-center gap-[7px] rounded-full px-[13px] py-[7px] text-[0.68rem] font-bold uppercase tracking-[0.2em]" style={{ background: soft(a, 0.14), color: a.base }}>
            <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: a.base }} />
            şu an canlı
          </span>
          <h2 className="font-display mt-5 text-[clamp(2.2rem,4vw,3.4rem)] font-bold leading-[0.98] tracking-[-0.02em]" style={{ color: T.text }}>
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
      <div className="relative mt-7 flex items-center justify-between gap-4 border-t pt-5" style={{ borderColor: "rgba(var(--border-rgb),0.08)" }}>
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
      {/* Desktop: yatay logo (tema-duyarlı) · Mobil: kare icon */}
      <Image
        src="/brand/fikirsepeti-logo.png"
        alt="FikirSepeti"
        width={958}
        height={220}
        priority
        className="fs-logo fs-logo--dark h-9 w-auto object-contain"
      />
      <Image
        src="/brand/fikirsepeti-logo-light.png"
        alt="FikirSepeti"
        width={947}
        height={220}
        priority
        className="fs-logo fs-logo--light h-9 w-auto object-contain"
      />
      <Image
        src="/brand/fikirsepeti-icon.png"
        alt="FikirSepeti"
        width={512}
        height={512}
        priority
        className="fs-logo-icon h-9 w-9 object-contain"
      />
    </Link>
  );
}

export default function Home() {
  const { ready, user } = useSession();
  const { name, tenantId } = useNameContext();
  const router = useRouter();
  const [baskets, setBaskets] = useState<Basket[]>([]);
  const [ideasBy, setIdeasBy] = useState<Record<string, Idea[]>>({});
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [mode, setMode] = useState<ModeTab>("kavanoz");
  const [statusTab, setStatusTab] = useState<"aktif" | "gecmis">("aktif");

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
    if (!user || !tenantId) {
      setLoading(false);
      return;
    }
    void refresh();
    const ch = supabase
      .channel("home:live")
      .on("postgres_changes", { event: "*", schema: "public", table: "baskets" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "ideas" }, () => void refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh closes over tenantId
  }, [tenantId, user]);

  const typed = useMemo(() => {
    if (mode === "hackathon") return baskets.filter((b) => b.type === "hackathon");
    if (mode === "etkinlik") return baskets.filter((b) => b.type === "etkinlik");
    return [];
  }, [baskets, mode]);
  const resolved = useMemo(() => typed.filter((b) => b.status === "resolved"), [typed]);
  const active = useMemo(() => typed.filter((b) => b.status !== "resolved"), [typed]);
  const live = useMemo(() => active.filter((b) => isLiveBasket(b, ideasBy[b.id] ?? [])), [active, ideasBy]);
  const activeRest = useMemo(() => active.filter((b) => !isLiveBasket(b, ideasBy[b.id] ?? [])), [active, ideasBy]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--bg)" }}>
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>
          Yükleniyor…
        </p>
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  if (!user.tenantId) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--bg)" }}>
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>
          Çalışma alanına yönlendiriliyor…
        </p>
      </div>
    );
  }

  const onCreate = async (input: { title: string; type: BasketType; resolve_method: ResolveMethod }) => {
    if (!tenantId) return;
    const created = await createBasket({ ...input, created_by: name, tenant_id: tenantId });
    if (created) router.push(`/basket/${created.id}`);
  };

  return (
    <main className="relative z-[1] min-h-screen" style={{ color: T.text }}>
      <header className="sticky top-0 z-20 flex items-center justify-between px-[clamp(24px,5vw,56px)] py-[14px]" style={{ borderBottom: `1px solid ${T.line}`, background: T.bg }}>
        <Wordmark />
        {/* Yeni sepet — ortada */}
        <button onClick={() => setModal(true)} className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1.5 rounded-full px-[18px] py-[10px] text-[0.9rem] font-semibold transition hover:-translate-y-px sm:inline-flex" style={{ background: T.text, color: "var(--bg)" }}>
          <span className="text-[1.05rem] leading-none">+</span> Yeni sepet
        </button>
        {/* profil — en sağ */}
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button onClick={() => setModal(true)} className="inline-flex items-center gap-1 rounded-full px-4 py-2 text-[0.9rem] font-semibold sm:hidden" style={{ background: T.text, color: "var(--bg)" }}>+ Yeni</button>
          {name && (
            <>
              <Link href="/archive" className="hidden text-[0.82rem] font-semibold sm:inline" style={{ color: T.muted }} data-testid="nav-archive">
                Arşiv
              </Link>
              <Link href="/analytics" className="hidden text-[0.82rem] font-semibold sm:inline" style={{ color: T.muted }} data-testid="nav-analytics">
                Analitik
              </Link>
              <Link href="/admin" className="hidden text-[0.82rem] font-semibold sm:inline" style={{ color: T.muted }} data-testid="nav-admin">
                Admin
              </Link>
              <Link href="/tenant/roles" className="hidden text-[0.82rem] font-semibold sm:inline" style={{ color: T.muted }}>
                Roller
              </Link>
              <Link href="/profil" className="flex items-center gap-[9px] rounded-full border py-1 pl-1 pr-[14px] transition hover:border-[rgba(var(--border-rgb),0.2)]" style={{ borderColor: T.line, background: T.card }}>
                <span className="grid h-7 w-7 place-items-center rounded-full text-[0.78rem] font-bold" style={{ background: "linear-gradient(135deg,#E7A93F,#F2795F)", color: "#0F0F0F" }}>
                  {name.charAt(0).toLocaleUpperCase("tr")}
                </span>
                <span className="text-[0.9rem]" style={{ color: T.t2 }}>{name}</span>
              </Link>
            </>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-[1180px] px-[clamp(24px,5vw,56px)] pb-[90px]">
        {/* HERO — editorial, kinetik */}
        <section className="pt-[clamp(56px,9vw,120px)] text-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="flex items-center justify-center gap-2.5"
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#E7A93F", boxShadow: "0 0 0 4px rgba(231,169,63,0.16)" }} />
            <span className="text-[0.72rem] font-semibold uppercase tracking-[0.34em]" style={{ color: T.muted }}>Duosis · Karar &amp; Hackathon</span>
          </motion.div>

          <h1 className="font-display mt-8 flex flex-col items-center font-bold leading-[0.9] tracking-[-0.03em] text-[clamp(3.4rem,9.5vw,7.4rem)]" style={{ color: T.text }}>
            <Reveal delay={0.12}><span>Bugün</span></Reveal>
            <Reveal delay={0.26}><RotatingQuestion /></Reveal>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.62 }}
            className="mx-auto mt-10 max-w-[46ch] text-[1.13rem] leading-[1.55]"
            style={{ color: T.t3 }}
          >
            Fikirleri <span className="font-semibold" style={{ color: "#D97757" }}>kavanoza</span> at — oyla, hackathon veya etkinliğe dönüştür. Hızlı yol: doğrudan sepet aç.
          </motion.p>
        </section>

        {/* üç tab — Kavanoz · Hackathon · Etkinlik */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.8 }}
          className="mt-[clamp(48px,7vw,72px)] flex justify-center"
        >
          <div
            className="inline-flex gap-1 rounded-full p-1"
            style={{ background: "rgba(var(--border-rgb),0.04)", border: "1px solid rgba(var(--border-rgb),0.08)" }}
            data-testid="home-mode-tabs"
          >
            {(
              [
                ["kavanoz", "Kavanoz", "#D97757"],
                ["hackathon", "Hackathon", "#E7A93F"],
                ["etkinlik", "Etkinlik", "#F2795F"],
              ] as const
            ).map(([key, label, accent]) => {
              const on = mode === key;
              return (
                <button
                  key={key}
                  onClick={() => setMode(key)}
                  className="flex items-center gap-2 rounded-full px-[18px] py-[9px] text-[0.9rem] font-semibold transition"
                  style={{
                    background: on ? T.card : "transparent",
                    color: on ? T.text : T.muted,
                    boxShadow: on ? "0 2px 8px -4px rgba(0,0,0,0.6)" : "none",
                  }}
                  data-testid={`tab-${key}`}
                >
                  {on && <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />}
                  {label}
                </button>
              );
            })}
          </div>
        </motion.div>

        {mode === "kavanoz" ? (
          <PoolPanel />
        ) : loading ? (
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-52 animate-pulse rounded-[22px]" style={{ background: T.card }} />
            ))}
          </div>
        ) : (
          <>
            <div className="mt-6 flex justify-center">
              <div className="inline-flex gap-1 rounded-full p-1" style={{ background: "rgba(var(--border-rgb),0.04)", border: "1px solid rgba(var(--border-rgb),0.08)" }}>
                {(
                  [
                    ["aktif", "Aktif", active.length],
                    ["gecmis", "Geçmiş", resolved.length],
                  ] as const
                ).map(([key, label, count]) => {
                  const on = statusTab === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setStatusTab(key)}
                      className="flex items-center gap-2 rounded-full px-[14px] py-[7px] text-[0.85rem] font-semibold"
                      style={{ background: on ? T.card : "transparent", color: on ? T.text : T.muted }}
                    >
                      {label}
                      <span className="tnum rounded-full px-[6px] text-[0.68rem]" style={{ color: T.faint }}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {typed.length === 0 ? (
              <div className="mt-6 rounded-[22px] py-20 text-center" style={{ background: T.card }}>
                <BrandIcon size="md" className="mb-4 inline-block opacity-90" />
                <p style={{ color: T.muted }}>
                  Henüz {mode === "hackathon" ? "hackathon" : "etkinlik"} yok.
                </p>
                <button
                  onClick={() => setModal(true)}
                  className="mt-3 font-display text-2xl font-semibold"
                  style={{ color: "#F2795F" }}
                >
                  Sepet aç →
                </button>
              </div>
            ) : statusTab === "aktif" ? (
              <div className="mt-[clamp(28px,4vw,44px)] flex flex-col gap-5">
                {live.map((b, i) => (
                  <motion.div
                    key={b.id}
                    initial={{ opacity: 0, y: 28 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: EASE, delay: 0.2 + i * 0.08 }}
                  >
                    <Featured basket={b} ideas={ideasBy[b.id] ?? []} />
                  </motion.div>
                ))}
                {activeRest.length > 0 && (
                  <div className="grid gap-5 md:grid-cols-2">
                    {activeRest.map((b, i) => (
                      <motion.div
                        key={b.id}
                        initial={{ opacity: 0, y: 28 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: EASE, delay: 0.25 + i * 0.07 }}
                      >
                        <RichCard basket={b} ideas={ideasBy[b.id] ?? []} />
                      </motion.div>
                    ))}
                  </div>
                )}
                {!live.length && !activeRest.length && (
                  <p className="py-12 text-center" style={{ color: T.muted }}>
                    Aktif sepet yok — geçmişe bak veya yeni aç.
                  </p>
                )}
              </div>
            ) : resolved.length === 0 ? (
              <div className="mt-6 rounded-[22px] py-16 text-center" style={{ background: T.card }}>
                <p style={{ color: T.muted }}>Henüz sonuçlanan yok.</p>
              </div>
            ) : (
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                {resolved.map((b) => (
                  <RichCard key={b.id} basket={b} ideas={ideasBy[b.id] ?? []} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <NewBasketModal open={modal} onClose={() => setModal(false)} onCreate={onCreate} />
    </main>
  );
}
