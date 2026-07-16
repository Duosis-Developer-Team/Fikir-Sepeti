"use client";

import Link from "next/link";
import { BrandIcon } from "@/components/BrandIcon";

/**
 * SG1 stub — full self-serve registration lands in SG2.
 * Route exists so Landing CTAs resolve without 404.
 */
export default function RegisterPage() {
  return (
    <div
      className="flex min-h-screen items-center justify-center px-6"
      style={{ background: "var(--bg)" }}
    >
      <div
        className="w-full max-w-sm rounded-[22px] p-8"
        style={{ background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.09)" }}
      >
        <BrandIcon size="md" priority />
        <h1
          className="font-display mt-5 text-[1.5rem] font-bold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          Kayıt
        </h1>
        <p className="mt-2 text-[0.92rem] leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Self-serve çalışma alanı açma yakında. Şimdilik iş e-postanla giriş yap; domain&apos;in
          tenant listesindeyse otomatik bağlanırsın.
        </p>
        <Link
          href="/login"
          className="mt-6 flex w-full items-center justify-center rounded-full py-3 text-[0.95rem] font-semibold transition hover:opacity-90"
          style={{ background: "var(--text)", color: "var(--bg)" }}
        >
          Girişe git
        </Link>
        <Link
          href="/"
          className="mt-3 block text-center text-[0.85rem] font-medium transition hover:opacity-80"
          style={{ color: "var(--text-faint)" }}
        >
          ← Ana sayfa
        </Link>
      </div>
    </div>
  );
}
