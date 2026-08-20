"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
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
  const [confirmSuspend, setConfirmSuspend] = useState<TenantRow | null>(null);
  const [confirmPlan, setConfirmPlan] = useState<{ tenant: TenantRow; next: "free" | "analytics" } | null>(null);

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
                        setConfirmPlan({ tenant: t, next: t.plan === "free" ? "analytics" : "free" });
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
                        if (t.status === "active") setConfirmSuspend(t);
                        else void patch(t.id, { status: "active" });
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

      <SuspendConfirmDialog
        tenant={confirmSuspend}
        busy={busy}
        onCancel={() => setConfirmSuspend(null)}
        onConfirm={async () => {
          if (!confirmSuspend) return;
          await patch(confirmSuspend.id, { status: "suspended" });
          setConfirmSuspend(null);
        }}
      />
      <PlanConfirmDialog
        data={confirmPlan}
        busy={busy}
        onCancel={() => setConfirmPlan(null)}
        onConfirm={async () => {
          if (!confirmPlan) return;
          await patch(confirmPlan.tenant.id, { plan: confirmPlan.next });
          setConfirmPlan(null);
        }}
      />
    </main>
  );
}

function DialogShell({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-[420px] overflow-hidden rounded-[22px] p-7"
            style={{
              background: "linear-gradient(180deg, var(--sheen), transparent 38%), var(--card)",
              border: "1px solid rgba(var(--border-rgb),0.1)",
              boxShadow: "0 50px 120px -40px rgba(0,0,0,0.9), inset 0 1px 0 var(--edge)",
            }}
            initial={{ scale: 0.96, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 16 }}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SuspendConfirmDialog({
  tenant,
  busy,
  onCancel,
  onConfirm,
}: {
  tenant: TenantRow | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  useEffect(() => setTyped(""), [tenant]);
  const match = !!tenant && typed.trim() === tenant.name;

  return (
    <DialogShell open={!!tenant} onClose={onCancel}>
      <h2 className="font-display text-[1.3rem] font-bold" style={{ color: "var(--text)" }}>
        Tenant&apos;ı askıya al
      </h2>
      <p className="mt-2 text-[0.88rem]" style={{ color: "var(--text-muted)" }}>
        <span className="font-semibold" style={{ color: "var(--text)" }}>{tenant?.user_count}</span> kullanıcının erişimi hemen kesilir. Devam etmek için tenant adını yaz:
      </p>
      <p className="mt-3 font-display text-[1.05rem] font-bold" style={{ color: "#F2795F" }}>{tenant?.name}</p>
      <input
        autoFocus
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder="tenant adını buraya yaz"
        className="mt-3 w-full rounded-lg px-3.5 py-2.5 text-[0.92rem] outline-none"
        style={{ background: "var(--surface-2)", border: "1px solid rgba(var(--border-rgb),0.09)", color: "var(--text)" }}
        data-testid="admin-suspend-confirm-input"
      />
      <div className="mt-6 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-5 py-[10px] text-[0.9rem] font-semibold transition hover:bg-[rgba(var(--border-rgb),0.05)]"
          style={{ color: "var(--text-muted)" }}
        >
          Vazgeç
        </button>
        <button
          type="button"
          disabled={!match || busy}
          onClick={onConfirm}
          className="rounded-full px-5 py-[10px] text-[0.9rem] font-bold transition disabled:opacity-40"
          style={{ background: "#F2795F", color: "#161616" }}
          data-testid="admin-suspend-confirm"
        >
          Askıya al
        </button>
      </div>
    </DialogShell>
  );
}

function PlanConfirmDialog({
  data,
  busy,
  onCancel,
  onConfirm,
}: {
  data: { tenant: TenantRow; next: "free" | "analytics" } | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <DialogShell open={!!data} onClose={onCancel}>
      <h2 className="font-display text-[1.3rem] font-bold" style={{ color: "var(--text)" }}>
        Planı değiştir
      </h2>
      <p className="mt-2 text-[0.88rem]" style={{ color: "var(--text-muted)" }}>
        <span className="font-semibold" style={{ color: "var(--text)" }}>{data?.tenant.name}</span> için:
      </p>
      <p className="mt-3 text-[1.15rem]" style={{ color: "var(--text)" }}>
        <span style={{ color: "var(--text-faint)" }}>{data?.tenant.plan}</span> → <span className="font-bold" style={{ color: "var(--clay)" }}>{data?.next}</span>
      </p>
      <div className="mt-6 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-5 py-[10px] text-[0.9rem] font-semibold transition hover:bg-[rgba(var(--border-rgb),0.05)]"
          style={{ color: "var(--text-muted)" }}
        >
          Vazgeç
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className="rounded-full px-5 py-[10px] text-[0.9rem] font-bold transition disabled:opacity-40"
          style={{ background: "var(--clay)", color: "#161616" }}
          data-testid="admin-plan-confirm"
        >
          Değiştir
        </button>
      </div>
    </DialogShell>
  );
}
