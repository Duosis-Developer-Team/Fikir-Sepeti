"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useNameContext } from "@/components/AuthGate";
import { listArchive, type ArchiveBasket } from "@/lib/archive";
import { deleteBasket } from "@/lib/db";
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
      <Link href="/" className="text-[0.9rem]" style={{ color: "var(--text-muted)" }}>
        ← Ana sayfa
      </Link>

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
          {baskets.map((b) => (
            <ArchiveRow
              key={b.id}
              basket={b}
              isOwner={Boolean(name) && b.created_by === name}
              onDeleted={() => setBaskets((prev) => prev.filter((x) => x.id !== b.id))}
            />
          ))}
        </div>
      )}
    </main>
  );
}

function ArchiveRow({
  basket: b,
  isOwner,
  onDeleted,
}: {
  basket: ArchiveBasket;
  isOwner: boolean;
  onDeleted: () => void;
}) {
  const a = accentFor({ id: b.id, type: b.type });
  const [confirmDel, setConfirmDel] = useState(false);
  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const doDelete = async (e: React.MouseEvent) => {
    stop(e);
    await deleteBasket(b.id);
    onDeleted();
  };
  return (
    <Link
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
        <span className="flex items-center gap-2.5">
          <span className="text-[0.8rem]" style={{ color: "var(--text-faint)" }}>
            {new Date(b.created_at).toLocaleDateString("tr-TR")}
          </span>
          {isOwner && (
            confirmDel ? (
              <span className="relative z-10 flex items-center gap-1.5" onClick={stop}>
                <span className="text-[0.74rem]" style={{ color: "var(--text-muted)" }}>Sil?</span>
                <button
                  onClick={doDelete}
                  className="rounded-full px-2.5 py-1 text-[0.72rem] font-bold transition hover:opacity-90"
                  style={{ background: "#F2795F", color: "#0F0F0F" }}
                >
                  Sil
                </button>
                <button
                  onClick={(e) => { stop(e); setConfirmDel(false); }}
                  className="rounded-full px-2 py-1 text-[0.72rem]"
                  style={{ color: "var(--text-faint)" }}
                >
                  Vazgeç
                </button>
              </span>
            ) : (
              <button
                onClick={(e) => { stop(e); setConfirmDel(true); }}
                aria-label="Sepeti sil"
                className="relative z-10 grid h-7 w-7 place-items-center rounded-full transition hover:bg-[rgba(242,121,95,0.15)]"
                style={{ color: "var(--text-faint)" }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" /></svg>
              </button>
            )
          )}
        </span>
      </div>
      <p className="mt-1 font-display text-[1.35rem] font-semibold" style={{ color: "var(--text)" }}>
        {b.title}
      </p>
    </Link>
  );
}
