"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useNameContext } from "@/components/AuthGate";
import {
  fetchAnalyticsFull,
  fetchAnalyticsTeaser,
  updateProductionMeta,
  type AnalyticsFull,
  type AnalyticsTeaser,
} from "@/lib/client-analytics";

export default function AnalyticsPage() {
  const { name, tenantId } = useNameContext();
  const [teaser, setTeaser] = useState<AnalyticsTeaser | null>(null);
  const [canViewFull, setCanViewFull] = useState(false);
  const [full, setFull] = useState<AnalyticsFull | null>(null);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [effort, setEffort] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!name || !tenantId) return;
    const t = await fetchAnalyticsTeaser({ email: name, tenantId });
    if (!t) {
      setError("Analitik yüklenemedi");
      return;
    }
    setTeaser(t.teaser);
    setCanViewFull(t.canViewFull);
    setError(null);

    if (t.canViewFull) {
      const f = await fetchAnalyticsFull({ email: name, tenantId });
      if (f && "funnel" in f) {
        setFull(f);
        setDenied(false);
      }
    } else {
      setFull(null);
      setDenied(false);
    }
  }, [name, tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const tryFull = async () => {
    if (!name || !tenantId) return;
    const f = await fetchAnalyticsFull({ email: name, tenantId });
    if (f && "status" in f && f.status === 403) {
      setDenied(true);
      return;
    }
    if (f && "funnel" in f) {
      setFull(f);
      setDenied(false);
    }
  };

  const saveMeta = async (basketId: string) => {
    if (!name || !tenantId) return;
    setBusy(true);
    const ok = await updateProductionMeta({
      email: name,
      tenantId,
      basketId,
      production_note: note || null,
      effort_estimate: effort === "" ? null : Number(effort),
    });
    setBusy(false);
    if (ok) {
      setEditId(null);
      await load();
    }
  };

  return (
    <div className="mx-auto max-w-[900px] px-[clamp(24px,5vw,56px)] py-10" data-testid="analytics-page">
      <div className="mb-8 flex items-baseline justify-between gap-4">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em]" style={{ color: "#D97757" }}>
            Analitik
          </p>
          <h1 className="font-display mt-2 text-[clamp(1.8rem,4vw,2.6rem)] font-bold" style={{ color: "var(--text)" }}>
            Katılım hunisi
          </h1>
          <p className="mt-2 max-w-xl text-[0.95rem]" style={{ color: "var(--text-muted)" }}>
            Fikirden üretime — dönüşüm ve 3. ay sürdürülen katılım.
          </p>
        </div>
        <Link href="/" className="text-[0.9rem]" style={{ color: "var(--text-muted)" }}>
          ← Ana sayfa
        </Link>
      </div>

      {error && (
        <p className="mb-4 text-[0.9rem]" style={{ color: "#F2795F" }} data-testid="analytics-error">
          {error}
        </p>
      )}

      {/* Teaser — always */}
      {teaser && (
        <section
          className="mb-8 rounded-2xl px-6 py-5"
          style={{ background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.1)" }}
          data-testid="analytics-teaser"
        >
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--text-faint)" }}>
            Özet
          </p>
          <p className="font-display mt-2 text-[1.45rem] font-bold" style={{ color: "var(--text)" }}>
            {teaser.headline}
          </p>
          <p className="mt-1 text-[0.9rem]" style={{ color: "var(--text-muted)" }}>
            Üretime alınan: {teaser.productionCount}
          </p>
          {!canViewFull && (
            <button
              type="button"
              onClick={() => void tryFull()}
              className="mt-4 rounded-full px-4 py-2 text-[0.85rem] font-semibold"
              style={{ background: "rgba(217,119,87,0.18)", color: "#D97757" }}
              data-testid="analytics-unlock"
            >
              Detayı aç · analytics.view
            </button>
          )}
        </section>
      )}

      {denied && (
        <p className="mb-6 text-[0.9rem]" style={{ color: "#E3A857" }} data-testid="analytics-denied">
          Detay için analytics.view izni gerekir. Özet yukarıda görünür — duvar değil, iştah.
        </p>
      )}

      {full && (
        <>
          <section className="mb-10" data-testid="analytics-funnel">
            <h2 className="mb-4 text-[0.7rem] font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--text-faint)" }}>
              Huni
            </h2>
            <div className="flex flex-col gap-3">
              {full.funnel.map((s) => {
                const max = full.funnel[0]?.count || 1;
                const w = Math.max(8, Math.round((s.count / max) * 100));
                return (
                  <div key={s.key} data-testid={`funnel-${s.key}`}>
                    <div className="mb-1 flex items-baseline justify-between gap-3">
                      <span className="text-[0.95rem] font-semibold" style={{ color: "var(--text)" }}>
                        {s.label}
                      </span>
                      <span className="tnum text-[0.9rem]" style={{ color: "var(--text-2)" }}>
                        {s.count}
                        {s.rateFromPrev != null && (
                          <span style={{ color: "var(--text-faint)" }}> · %{s.rateFromPrev}</span>
                        )}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full" style={{ background: "rgba(var(--border-rgb),0.12)" }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${w}%`,
                          background: "linear-gradient(90deg,#D97757,#E3A857)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mb-10" data-testid="analytics-retention">
            <h2 className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--text-faint)" }}>
              3. ay sürdürülen katılım
            </h2>
            <div
              className="rounded-2xl px-6 py-5"
              style={{ background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.1)" }}
            >
              <p className="font-display text-[2.4rem] font-bold" style={{ color: "#E3A857" }}>
                %{full.retention.rate}
              </p>
              <p className="mt-1 text-[0.9rem]" style={{ color: "var(--text-muted)" }}>
                {full.retention.anchorMonth} aktif {full.retention.month1Active} kişiden{" "}
                {full.retention.month3Active} kişi {full.retention.asOfMonth} ayında da katıldı.
              </p>
            </div>
          </section>

          <section data-testid="analytics-production">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--text-faint)" }}>
                Üretime alınanlar
              </h2>
              <span className="tnum text-[0.85rem]" style={{ color: "var(--text-muted)" }}>
                Toplam efor: {full.effortTotal} gün
              </span>
            </div>
            {full.production.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }}>Henüz üretime alınan sepet yok.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {full.production.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-xl px-4 py-3"
                    style={{ background: "var(--surface-2)", border: "1px solid rgba(var(--border-rgb),0.08)" }}
                    data-testid={`production-row-${p.id}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <Link
                          href={`/basket/${p.id}/result`}
                          className="font-semibold"
                          style={{ color: "var(--text)" }}
                        >
                          {p.title}
                        </Link>
                        <p className="mt-1 text-[0.85rem]" style={{ color: "var(--text-muted)" }}>
                          {p.production_note || "Not yok"} · efor: {p.effort_estimate ?? "—"}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="text-[0.8rem] font-semibold"
                        style={{ color: "#D97757" }}
                        onClick={() => {
                          setEditId(p.id);
                          setNote(p.production_note ?? "");
                          setEffort(p.effort_estimate != null ? String(p.effort_estimate) : "");
                        }}
                        data-testid={`edit-production-${p.id}`}
                      >
                        Efor / not
                      </button>
                    </div>
                    {editId === p.id && (
                      <div className="mt-3 flex flex-col gap-2" data-testid="production-edit-form">
                        <input
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Ne yapıldı, kim yaptı"
                          className="rounded-lg px-3 py-2 text-[0.9rem]"
                          style={{ background: "var(--bg)", color: "var(--text)", border: "1px solid rgba(var(--border-rgb),0.15)" }}
                          data-testid="production-note-input"
                        />
                        <input
                          value={effort}
                          onChange={(e) => setEffort(e.target.value)}
                          placeholder="Tahmini adam-gün"
                          type="number"
                          min={0}
                          step={0.5}
                          className="rounded-lg px-3 py-2 text-[0.9rem]"
                          style={{ background: "var(--bg)", color: "var(--text)", border: "1px solid rgba(var(--border-rgb),0.15)" }}
                          data-testid="production-effort-input"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void saveMeta(p.id)}
                            className="rounded-full px-4 py-1.5 text-[0.85rem] font-semibold"
                            style={{ background: "#D97757", color: "#161616" }}
                            data-testid="production-save"
                          >
                            Kaydet
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditId(null)}
                            className="text-[0.85rem]"
                            style={{ color: "var(--text-muted)" }}
                          >
                            İptal
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
