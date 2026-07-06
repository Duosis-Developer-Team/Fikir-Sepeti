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
  const resolved = basket.status === "resolved";

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Link
        href={`/basket/${basket.id}`}
        className="group block rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[color:var(--text-muted)]"
        style={{ borderLeftWidth: 3, borderLeftColor: accent }}
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ background: `${accent}14`, color: accent }}
          >
            {isBuild ? "build" : "sosyal"}
          </span>
          <span className="text-xs text-[var(--text-muted)]">
            {resolved ? "sonuçlandı" : PHASE_LABEL[basket.phase] ?? basket.phase}
          </span>
        </div>
        <p className="mt-3 font-medium leading-snug">{basket.title}</p>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          {isBuild ? "iç hackathon" : basket.resolve_method === "raffle" ? "kura" : "oylama"}
          {basket.created_by ? ` · ${basket.created_by}` : ""}
        </p>
      </Link>
    </motion.div>
  );
}
