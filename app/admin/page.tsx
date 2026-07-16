"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useNameContext, useSession } from "@/components/AuthGate";

type TenantRow = {
  id: string;
  name: string;
  plan: string;
  status: string;
  created_at: string;
  domains: string[];
  user_count: number;
};

type DetailUser = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  roles: { key: string; label: string }[];
};

async function headers(email: string, tenantId: string) {
  const { apiAuthHeaders } = await import("@/lib/api-headers");
  return apiAuthHeaders(email, tenantId);
}

export default function AdminPage() {
  const { name, tenantId } = useNameContext();
  const { user } = useSession();
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detailUsers, setDetailUsers] = useState<DetailUser[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId || !name) return;
    const res = await fetch("/api/admin/tenants", { headers: await headers(name, tenantId) });
    if (res.status === 403) {
      setError("platform.manage_tenants izni gerekli.");
      setTenants([]);
      return;
    }
    if (!res.ok) {
      setError("Yüklenemedi");
      return;
    }
    const json = await res.json();
    setTenants(json.tenants ?? []);
    setError(null);
  }, [tenantId, name]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadDetail = async (id: string) => {
    if (!tenantId || !name) return;
    setSelected(id);
    const res = await fetch(`/api/admin/tenants/${id}`, {
      headers: await headers(name, tenantId),
    });
    if (!res.ok) {
      setDetailUsers([]);
      return;
    }
    const json = await res.json();
    setDetailUsers(json.users ?? []);
  };

  const patch = async (
    tenantRowId: string,
    body: { plan?: "free" | "analytics"; status?: "active" | "suspended" }
  ) => {
    if (!tenantId || !name) return;
    setBusy(true);
    const res = await fetch("/api/admin/tenants", {
      method: "PATCH",
      headers: await headers(name, tenantId),
      body: JSON.stringify({ tenantId: tenantRowId, ...body }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError((j as { error?: string }).error ?? "Güncellenemedi");
      return;
    }
    await load();
    if (selected === tenantRowId) await loadDetail(tenantRowId);
  };

  if (!user?.tenantId) return null;

  return (
    <main className="mx-auto max-w-[1100px] px-[clamp(24px,5vw,40px)] pb-[90px] pt-[clamp(28px,4vw,48px)]">
      <Link href="/" className="text-[0.88rem]" style={{ color: "var(--text-muted)" }}>
        ← sepetler
      </Link>
      <h1 className="font-display mt-6 text-[2rem] font-bold" style={{ color: "var(--text)" }}>
        Platform · Tenantlar
      </h1>
      <p className="mt-2 text-[0.95rem]" style={{ color: "var(--text-muted)" }}>
        Plan, durum ve kullanıcılar — yalnızca platform_owner.
      </p>

      {error && (
        <p
          className="mt-4 rounded-xl px-4 py-3 text-[0.9rem]"
          style={{ background: "rgba(242,121,95,0.12)", color: "#F2795F" }}
          role="alert"
        >
          {error}
        </p>
      )}

      {!error && (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <section
            className="rounded-[22px] p-5"
            style={{ background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.09)" }}
          >
            <h2 className="font-display text-lg font-bold" style={{ color: "var(--text)" }}>
              Tenant listesi
            </h2>
            <div className="mt-4 flex flex-col gap-3">
              {tenants.map((t) => (
                <div
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => void loadDetail(t.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") void loadDetail(t.id);
                  }}
                  className="cursor-pointer rounded-xl px-4 py-3 text-left transition"
                  style={{
                    background: selected === t.id ? "var(--surface-2)" : "transparent",
                    border: `1px solid ${
                      selected === t.id ? "rgba(217,119,87,0.45)" : "rgba(var(--border-rgb),0.1)"
                    }`,
                  }}
                  data-testid={`admin-tenant-${t.id}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold" style={{ color: "var(--text)" }}>
                      {t.name}
                    </span>
                    <span className="text-[0.78rem] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
                      {t.plan} · {t.status}
                    </span>
                  </div>
                  <p className="mt-1 text-[0.82rem]" style={{ color: "var(--text-muted)" }}>
                    {(t.domains ?? []).join(", ") || "domain yok"} · {t.user_count} kullanıcı
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={(e) => {
                        e.stopPropagation();
                        void patch(t.id, {
                          plan: t.plan === "free" ? "analytics" : "free",
                        });
                      }}
                      className="rounded-full px-3 py-1 text-[0.78rem] font-semibold"
                      style={{ border: "1px solid rgba(var(--border-rgb),0.15)", color: "var(--text-2)" }}
                    >
                      Plan: {t.plan === "free" ? "→ analytics" : "→ free"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={(e) => {
                        e.stopPropagation();
                        void patch(t.id, {
                          status: t.status === "active" ? "suspended" : "active",
                        });
                      }}
                      className="rounded-full px-3 py-1 text-[0.78rem] font-semibold"
                      style={{
                        border: "1px solid rgba(var(--border-rgb),0.15)",
                        color: t.status === "active" ? "#F2795F" : "var(--green)",
                      }}
                      data-testid={`admin-toggle-status-${t.id}`}
                    >
                      {t.status === "active" ? "Askıya al" : "Aktifleştir"}
                    </button>
                  </div>
                </div>
              ))}
              {!tenants.length && (
                <p style={{ color: "var(--text-muted)" }}>Tenant yok.</p>
              )}
            </div>
          </section>

          <section
            className="rounded-[22px] p-5"
            style={{ background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.09)" }}
          >
            <h2 className="font-display text-lg font-bold" style={{ color: "var(--text)" }}>
              Kullanıcılar
            </h2>
            {!selected && (
              <p className="mt-3 text-[0.9rem]" style={{ color: "var(--text-muted)" }}>
                Detay için soldan bir tenant seç.
              </p>
            )}
            <div className="mt-4 flex flex-col gap-2">
              {detailUsers.map((u) => (
                <div
                  key={u.user_id}
                  className="rounded-lg px-3 py-2"
                  style={{ background: "var(--surface-2)" }}
                >
                  <div className="font-semibold text-[0.92rem]" style={{ color: "var(--text)" }}>
                    {u.display_name || u.email || u.user_id}
                  </div>
                  <div className="text-[0.8rem]" style={{ color: "var(--text-muted)" }}>
                    {(u.roles ?? []).map((r) => r.label).join(", ") || "rol yok"}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
