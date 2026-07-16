"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useNameContext } from "@/components/AuthGate";

type Rule = {
  id: string;
  pattern: string;
  kind: string;
  action: string;
  enabled: boolean;
};

type Flag = {
  id: string;
  entity_type: string;
  entity_id: string;
  matched_text: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
};

function headers(email: string, tenantId: string) {
  return {
    "Content-Type": "application/json",
    "X-Dev-User": JSON.stringify({ email, tenantId }),
  };
}

export default function ModerationPage() {
  const { name, tenantId } = useNameContext();
  const [rules, setRules] = useState<Rule[]>([]);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [pattern, setPattern] = useState("");
  const [action, setAction] = useState<"warn" | "block">("warn");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!name || !tenantId) return;
    const h = headers(name, tenantId);
    const [rRes, fRes] = await Promise.all([
      fetch("/api/moderation/rules", { headers: h }),
      fetch("/api/moderation/flags?status=pending", { headers: h }),
    ]);
    if (rRes.ok) {
      const j = await rRes.json();
      setRules(j.rules ?? []);
    }
    if (fRes.status === 403) {
      setError("content.moderate izni gerekli (kuyruk).");
      setFlags([]);
    } else if (fRes.ok) {
      const j = await fRes.json();
      setFlags(j.flags ?? []);
      setError(null);
    }
  }, [name, tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addRule = async () => {
    if (!name || !tenantId || pattern.trim().length < 1) return;
    const res = await fetch("/api/moderation/rules", {
      method: "POST",
      headers: headers(name, tenantId),
      body: JSON.stringify({ pattern: pattern.trim(), action, kind: "word" }),
    });
    if (!res.ok) {
      setError("Kural eklenemedi");
      return;
    }
    setPattern("");
    setAction("warn");
    await load();
  };

  const removeRule = async (id: string) => {
    if (!name || !tenantId) return;
    await fetch(`/api/moderation/rules?id=${id}`, {
      method: "DELETE",
      headers: headers(name, tenantId),
    });
    await load();
  };

  const setRuleAction = async (id: string, next: "warn" | "block") => {
    if (!name || !tenantId) return;
    await fetch("/api/moderation/rules", {
      method: "PATCH",
      headers: headers(name, tenantId),
      body: JSON.stringify({ id, action: next }),
    });
    await load();
  };

  const resolve = async (id: string, decision: "approve" | "hide") => {
    if (!name || !tenantId) return;
    await fetch("/api/moderation/flags", {
      method: "PATCH",
      headers: headers(name, tenantId),
      body: JSON.stringify({ id, decision }),
    });
    await load();
  };

  return (
    <div className="mx-auto max-w-[880px] px-[clamp(24px,5vw,56px)] py-10" data-testid="moderation-page">
      <div className="mb-8 flex items-baseline justify-between gap-4">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em]" style={{ color: "#D97757" }}>
            Moderasyon
          </p>
          <h1 className="font-display mt-2 text-[clamp(1.8rem,4vw,2.6rem)] font-bold" style={{ color: "var(--text)" }}>
            Kurallar &amp; kuyruk
          </h1>
          <p className="mt-2 text-[0.95rem]" style={{ color: "var(--text-muted)" }}>
            Varsayılan hafif: yeni kurallar <strong>uyar</strong>; engelleme bilinçli seçim.
          </p>
        </div>
        <Link href="/" className="text-[0.9rem]" style={{ color: "var(--text-muted)" }}>
          ← Ana sayfa
        </Link>
      </div>

      {error && (
        <p className="mb-4 text-[0.9rem]" style={{ color: "#E3A857" }} data-testid="moderation-error">
          {error}
        </p>
      )}

      <section className="mb-10" data-testid="moderation-rules">
        <h2 className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--text-faint)" }}>
          Kelime / desen listesi
        </h2>
        <div className="mb-4 flex flex-wrap gap-2">
          <input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="ör. spam"
            className="min-w-[180px] flex-1 rounded-xl px-3 py-2.5 text-[0.95rem]"
            style={{ background: "var(--surface-2)", color: "var(--text)", border: "1px solid rgba(var(--border-rgb),0.1)" }}
            data-testid="rule-pattern"
          />
          <select
            value={action}
            onChange={(e) => setAction(e.target.value as "warn" | "block")}
            className="rounded-xl px-3 py-2.5 text-[0.9rem]"
            style={{ background: "var(--surface-2)", color: "var(--text)" }}
            data-testid="rule-action"
          >
            <option value="warn">uyar</option>
            <option value="block">engelle</option>
          </select>
          <button
            type="button"
            onClick={() => void addRule()}
            className="rounded-full px-4 py-2 text-[0.85rem] font-semibold"
            style={{ background: "#D97757", color: "#161616" }}
            data-testid="rule-add"
          >
            Ekle
          </button>
        </div>
        <ul className="flex flex-col gap-2">
          {rules.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-3"
              style={{ background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.08)" }}
              data-testid={`rule-row-${r.id}`}
            >
              <span style={{ color: "var(--text)" }}>
                <code className="text-[0.95rem]">{r.pattern}</code>
                <span className="ml-2 text-[0.8rem]" style={{ color: "var(--text-faint)" }}>
                  {r.action === "block" ? "engelle" : "uyar"}
                </span>
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-[0.8rem] font-semibold"
                  style={{ color: "#E3A857" }}
                  onClick={() => void setRuleAction(r.id, r.action === "block" ? "warn" : "block")}
                >
                  {r.action === "block" ? "→ uyar" : "→ engelle"}
                </button>
                <button
                  type="button"
                  className="text-[0.8rem]"
                  style={{ color: "var(--text-muted)" }}
                  onClick={() => void removeRule(r.id)}
                  data-testid={`rule-delete-${r.id}`}
                >
                  Sil
                </button>
              </div>
            </li>
          ))}
          {rules.length === 0 && (
            <p style={{ color: "var(--text-muted)" }}>Henüz kural yok — yeni tenant’ta engelleme kapalı.</p>
          )}
        </ul>
      </section>

      <section data-testid="moderation-queue">
        <h2 className="mb-3 text-[0.7rem] font-semibold uppercase tracking-[0.22em]" style={{ color: "var(--text-faint)" }}>
          Bayraklı içerik
        </h2>
        <ul className="flex flex-col gap-2">
          {flags.map((f) => (
            <li
              key={f.id}
              className="rounded-xl px-4 py-3"
              style={{ background: "var(--surface-2)" }}
              data-testid={`flag-row-${f.id}`}
            >
              <p style={{ color: "var(--text)" }}>
                {f.entity_type} · {f.matched_text || "eşleşme"}
              </p>
              <p className="text-[0.8rem]" style={{ color: "var(--text-faint)" }}>
                {f.created_by} · {f.entity_id}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="rounded-full px-3 py-1.5 text-[0.8rem] font-semibold"
                  style={{ background: "rgba(51,194,147,0.2)", color: "#6FD9B4" }}
                  onClick={() => void resolve(f.id, "approve")}
                  data-testid={`flag-approve-${f.id}`}
                >
                  Onayla
                </button>
                <button
                  type="button"
                  className="rounded-full px-3 py-1.5 text-[0.8rem] font-semibold"
                  style={{ background: "rgba(242,121,95,0.2)", color: "#F2795F" }}
                  onClick={() => void resolve(f.id, "hide")}
                  data-testid={`flag-hide-${f.id}`}
                >
                  Gizle
                </button>
              </div>
            </li>
          ))}
          {flags.length === 0 && (
            <p style={{ color: "var(--text-muted)" }}>Bekleyen bayrak yok.</p>
          )}
        </ul>
      </section>
    </div>
  );
}
