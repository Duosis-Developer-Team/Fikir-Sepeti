"use client";

import Link from "next/link";
import { motion } from "motion/react";
import type { Basket } from "@/lib/types";

const PHASE_LABEL: Record<string, string> = {
  ideas: "fikir topluyor",
  finalists: "finalist oylaması",
  demos: "demo hazırlığı",
  voting: "canlı oylama",
  squad: "squad kuruluyor",
  resolved: "sonuçlandı",
};

export function BasketCard({ basket }: { basket: Basket }) {
  const isBuild = basket.type === "build";
  const accent = isBuild ? "var(--accent-build)" : "var(--accent-social)";
  const glow = isBuild ? "var(--accent-build-glow)" : "var(--accent-social-glow)";
  const soft = isBuild ? "var(--accent-build-soft)" : "var(--accent-social-soft)";
  const resolved = basket.status === "resolved";
  const live = basket.phase === "voting";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      whileHover={{ y: -3 }}
      className="group relative"
    >
      <Link
        href={`/basket/${basket.id}`}
        className="relative block overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 transition-shadow duration-300"
        style={{ boxShadow: "0 1px 0 rgba(255,255,255,0.02) inset" }}
        onMouseEnter={(e) => (e.currentTarget.style.boxShadow = `0 12px 40px -16px ${glow}`)}
        onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 1px 0 rgba(255,255,255,0.02) inset")}
      >
        {/* köşe parıltısı — moda göre */}
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-60 blur-2xl transition-opacity group-hover:opacity-100"
          style={{ background: soft }}
          aria-hidden
        />

        <div className="relative flex items-center justify-between gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{ background: soft, color: accent }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
            {isBuild ? "build" : "sosyal"}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            {live && (
              <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: accent }} />
            )}
            {resolved ? "sonuçlandı" : PHASE_LABEL[basket.phase] ?? basket.phase}
          </span>
        </div>

        <p className="font-display relative mt-4 text-lg font-semibold leading-snug tracking-tight text-[var(--text)]">
          {basket.title}
        </p>

        <p className="relative mt-3 text-xs text-[var(--text-muted)]">
          {isBuild ? "iç hackathon" : basket.resolve_method === "raffle" ? "kura" : "oylama"}
          {basket.created_by ? ` · ${basket.created_by}` : ""}
        </p>
      </Link>
    </motion.div>
  );
}
