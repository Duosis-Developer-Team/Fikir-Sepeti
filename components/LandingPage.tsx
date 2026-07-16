"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { BrandIcon } from "@/components/BrandIcon";
import { ThemeToggle } from "@/components/ThemeToggle";

const EASE = [0.16, 1, 0.3, 1] as const;

const LAYERS = [
  {
    key: "free",
    accent: "var(--clay)",
    label: "Ücretsiz",
    title: "Sepetten çekilişe",
    body: "Fikir biriktir, hackathon ve etkinlik aç, oyla veya kurayla seç. Tüm ekipler için.",
    cta: { href: "/register", text: "Başla" },
  },
  {
    key: "analytics",
    accent: "var(--gold)",
    label: "Analitik",
    title: "Huni ve katılım",
    body: "Fikir → organizasyon → üretime alınan. Dönüşüm oranları ve 3. ay katılım trendi.",
    cta: { href: "/login", text: "Giriş yap" },
  },
  {
    key: "integration",
    accent: "var(--coral)",
    label: "Entegrasyon",
    title: "Her mesleğe göre",
    body: "Üretim kapısından sonra efor ve araç köprüleri. İletişime geç, birlikte kuralım.",
    cta: { href: "mailto:hello@duosis.com", text: "İletişime geç" },
  },
] as const;

export function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(217,119,87,0.14), transparent 55%), radial-gradient(ellipse 60% 40% at 90% 20%, rgba(231,169,63,0.08), transparent 50%)",
        }}
      />

      <header className="relative z-10 flex items-center justify-between px-[clamp(24px,5vw,56px)] py-5">
        <div className="flex items-center gap-3">
          <BrandIcon size="sm" priority />
          <span className="font-display text-lg font-bold tracking-tight" style={{ color: "var(--text)" }}>
            Fikir Sepeti
          </span>
        </div>
        <nav className="flex items-center gap-2 sm:gap-3" aria-label="Hesap">
          <ThemeToggle />
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-[0.9rem] font-semibold transition hover:opacity-90"
            style={{ color: "var(--text-2)" }}
          >
            Giriş
          </Link>
          <Link
            href="/register"
            className="rounded-full px-4 py-2 text-[0.9rem] font-semibold transition hover:opacity-90"
            style={{ background: "var(--text)", color: "var(--bg)" }}
          >
            Kayıt
          </Link>
        </nav>
      </header>

      <main className="relative z-10 px-[clamp(24px,5vw,56px)] pb-20 pt-10 md:pt-16">
        <section className="mx-auto max-w-3xl text-center">
          <motion.p
            className="text-xs font-bold uppercase tracking-[0.22em]"
            style={{ color: "var(--clay)" }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            DuoSis
          </motion.p>
          <motion.h1
            className="font-display mt-4 text-[clamp(2.4rem,7vw,4rem)] font-bold leading-[1.05] tracking-tight"
            style={{ color: "var(--text)" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease: EASE, delay: 0.08 }}
          >
            Fikirden prototipe.
          </motion.h1>
          <motion.p
            className="mx-auto mt-5 max-w-xl text-[1.05rem] leading-relaxed"
            style={{ color: "var(--text-muted)" }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.16 }}
          >
            Çalışan fikirlerini üretim kararına hazır prototiplere dönüştür. İmza an: sepetten
            çekiliş — shuffle, reveal, confetti.
          </motion.p>
          <motion.div
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: EASE, delay: 0.24 }}
          >
            <Link
              href="/register"
              className="rounded-full px-6 py-3 text-[0.95rem] font-semibold transition hover:opacity-90"
              style={{ background: "var(--clay)", color: "#161616" }}
            >
              Ücretsiz başla
            </Link>
            <Link
              href="/login"
              className="rounded-full px-6 py-3 text-[0.95rem] font-semibold transition hover:opacity-90"
              style={{
                border: "1px solid rgba(var(--border-rgb),0.18)",
                color: "var(--text)",
              }}
            >
              Giriş yap
            </Link>
          </motion.div>
        </section>

        <section className="mx-auto mt-20 grid max-w-5xl gap-4 md:grid-cols-3" aria-label="Katmanlar">
          {LAYERS.map((layer, i) => (
            <motion.article
              key={layer.key}
              className="flex flex-col rounded-[22px] p-6 text-left"
              style={{
                background: "var(--card)",
                border: "1px solid rgba(var(--border-rgb),0.09)",
              }}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: EASE, delay: 0.3 + i * 0.08 }}
            >
              <span
                className="text-[0.72rem] font-bold uppercase tracking-[0.18em]"
                style={{ color: layer.accent }}
              >
                {layer.label}
              </span>
              <h2
                className="font-display mt-3 text-xl font-bold tracking-tight"
                style={{ color: "var(--text)" }}
              >
                {layer.title}
              </h2>
              <p className="mt-2 flex-1 text-[0.92rem] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {layer.body}
              </p>
              <Link
                href={layer.cta.href}
                className="mt-5 inline-flex text-[0.9rem] font-semibold transition hover:opacity-80"
                style={{ color: layer.accent }}
              >
                {layer.cta.text} →
              </Link>
            </motion.article>
          ))}
        </section>
      </main>
    </div>
  );
}
