"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useNameContext } from "@/components/AuthGate";
import { ThemeToggle } from "@/components/ThemeToggle";
import { listArchive, type ArchiveBasket } from "@/lib/archive";
import { accentFor, soft } from "@/lib/accent";

export default function ArchivePage() {
  const { name, tenantId } = useNameContext();
  const [baskets, setBaskets] = useState<ArchiveBasket[]>([]);
  const [type, setType] = useState<string>("");
  const [q, setQ] = useState("");
  const [viewAll, setViewAll] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId || !name) return;
    setLoading(true);
    void listArchive({ email: name, tenantId, type: type || undefined, q: q || undefined }).then(
      (res) => {
        setBaskets(res.baskets);
        setViewAll(res.viewAll);
        setLoading(false);
      }
    );
  }, [tenantId, name, type, q]);

  return (
    <main className="mx-auto min-h-screen max-w-[960px] px-[clamp(24px,5vw,48px)] pb-20 pt-8">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="text-[0.9rem]" style={{ color: "var(--text-muted)" }}>
          ← Ana sayfa
        </Link>
        <ThemeToggle />
      </div>

      <h1 className="font-display mt-8 text-[clamp(2rem,4vw,3rem)] font-bold" style={{ color: "var(--text)" }}>
        Arşiv
      </h1>
      <p className="mt-2 text-[0.95rem]" style={{ color: "var(--text-muted)" }}>
        Biten sepetlerin kalıcı sonucu.{" "}
        {viewAll ? "Tüm tenant arşivi." : "Yalnızca katıldığın sepetler."}
      </p>

      <div className="mt-6 flex flex-wrap gap-3" data-testid="archive-filters">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-full px-4 py-2 text-[0.85rem]"
          style={{ background: "var(--card)", color: "var(--text)", border: "1px solid rgba(var(--border-rgb),0.1)" }}
          data-testid="archive-filter-type"
        >
          <option value="">tüm tipler</option>
          <option value="etkinlik">etkinlik</option>
          <option value="hackathon">hackathon</option>
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ara…"
          className="rounded-full px-4 py-2 text-[0.9rem] outline-none"
          style={{ background: "var(--card)", color: "var(--text)", border: "1px solid rgba(var(--border-rgb),0.1)", minWidth: 180 }}
          data-testid="archive-search"
        />
      </div>

      {loading ? (
        <div className="mt-8 grid gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl" style={{ background: "var(--card)" }} />
          ))}
        </div>
      ) : !baskets.length ? (
        <p className="mt-12 text-center" style={{ color: "var(--text-muted)" }} data-testid="archive-empty">
          Arşivde sonuç yok.
        </p>
      ) : (
        <div className="mt-8 flex flex-col gap-3" data-testid="archive-list">
          {baskets.map((b) => {
            const a = accentFor({ id: b.id, type: b.type });
            return (
              <Link
                key={b.id}
                href={`/basket/${b.id}/result`}
                className="rounded-[20px] px-5 py-4 transition hover:-translate-y-0.5"
                style={{
                  background: "var(--card)",
                  border: `1px solid ${soft(a, 0.35)}`,
                  boxShadow: "var(--card-shadow)",
                }}
                data-testid={`archive-row-${b.id}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className="text-[0.7rem] font-bold uppercase tracking-[0.18em]"
                    style={{ color: a.base }}
                  >
                    {b.type}
                  </span>
                  <span className="text-[0.8rem]" style={{ color: "var(--text-faint)" }}>
                    {new Date(b.created_at).toLocaleDateString("tr-TR")}
                  </span>
                </div>
                <p className="mt-1 font-display text-[1.35rem] font-semibold" style={{ color: "var(--text)" }}>
                  {b.title}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
