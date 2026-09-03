"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useNameContext, useSession } from "@/components/AuthGate";
import { PERMISSIONS, PERMISSION_LABELS } from "@/lib/permissions";
import { apiFetch } from "@/lib/api-headers";

type Role = { id: string; key: string; label: string; is_system: boolean };
type Assignment = { id: string; user_id: string; role_id: string; scope_basket_id: string | null };
type UserRow = { user_id: string; email: string | null; display_name: string | null };
type PermRow = { role_id: string; permission_key: string };

async function apiHeaders(email: string, tenantId: string) {
  const { apiAuthHeaders } = await import("@/lib/api-headers");
  return apiAuthHeaders(email, tenantId);
}

export default function TenantRolesPage() {
  const { name, tenantId } = useNameContext();
  const { user } = useSession();
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<PermRow[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);

  const load = useCallback(async () => {
    if (!tenantId || !name) return;
    const res = await fetch("/api/tenant/roles", {
      headers: await apiHeaders(name, tenantId),
    });
    if (res.status === 403) {
      setError("Bu sayfa için tenant.manage_roles izni gerekli.");
      return;
    }
    if (!res.ok) {
      setError("Yüklenemedi");
      return;
    }
    const json = await res.json();
    setRoles(json.roles);
    setPerms(json.permissions);
    setAssignments(json.assignments);
    setUsers(json.users);
    setError(null);
  }, [tenantId, name]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (userId: string, roleId: string, has: boolean) => {
    if (!tenantId || !name) return;
    setBusy(true);
    await fetch("/api/tenant/roles", {
      method: "POST",
      headers: await apiHeaders(name, tenantId),
      body: JSON.stringify({
        action: has ? "revoke" : "assign",
        userId,
        roleId,
      }),
    });
    await load();
    setBusy(false);
  };

  const createInvite = async () => {
    if (!tenantId) return;
    setInviteBusy(true);
    setInviteCode(null);
    const res = await apiFetch<{ code: string }>("/api/tenant/invite", {
      method: "POST",
      email: name,
      tenantId,
    });
    if (!res.ok) {
      setError(res.error ?? "Davet kodu üretilemedi");
    } else {
      setInviteCode(res.data?.code ?? null);
      setError(null);
    }
    setInviteBusy(false);
  };

  if (!user) return null;

  return (
    <main className="mx-auto max-w-[960px] px-[clamp(24px,5vw,40px)] pb-[90px] pt-[clamp(28px,4vw,48px)]">
      <Link href="/" className="text-[0.88rem]" style={{ color: "var(--text-muted)" }}>
        ← Ana sayfa
      </Link>
      <h1 className="font-display mt-6 text-[2rem] font-bold" style={{ color: "var(--text)" }}>
        Tenant · Roller
      </h1>
      <p className="mt-2 text-[0.95rem]" style={{ color: "var(--text-muted)" }}>
        Kullanıcılara rol ata. İzin matrisi sistem rollerinden gelir.
      </p>

      {error && (
        <p className="mt-4 rounded-xl px-4 py-3 text-[0.9rem]" style={{ background: "rgba(242,121,95,0.12)", color: "#F2795F" }}>
          {error}
        </p>
      )}

      {!error && (
        <>
          <section className="mt-8 rounded-[22px] p-6" style={{ background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.09)" }}>
            <h2 className="font-display text-[1.2rem] font-bold" style={{ color: "var(--text)" }}>
              Davet kodu
            </h2>
            <p className="mt-2 text-[0.9rem]" style={{ color: "var(--text-muted)" }}>
              Domain dışı kullanıcıları bu kodla çalışma alanına al.
            </p>
            <button
              type="button"
              disabled={inviteBusy}
              onClick={() => void createInvite()}
              className="mt-4 rounded-full px-4 py-2 text-[0.9rem] font-semibold disabled:opacity-40"
              style={{ background: "var(--text)", color: "var(--bg)" }}
            >
              {inviteBusy ? "…" : "Kod üret"}
            </button>
            {inviteCode && (
              <p
                className="mt-3 font-display text-2xl font-bold tracking-[0.2em]"
                style={{ color: "var(--clay)" }}
                data-testid="invite-code"
              >
                {inviteCode}
              </p>
            )}
          </section>

          <section className="mt-8 rounded-[22px] p-6" style={{ background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.09)" }}>
            <h2 className="font-display text-[1.2rem] font-bold" style={{ color: "var(--text)" }}>İzin matrisi</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-[0.82rem]">
                <thead>
                  <tr style={{ color: "var(--text-muted)" }}>
                    <th className="py-2 pr-3 min-w-[220px]">İzin</th>
                    {roles.map((r) => (
                      <th key={r.id} className="px-2 py-2 text-center font-semibold whitespace-nowrap" style={{ color: "var(--text)" }}>
                        {r.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSIONS.map((p) => {
                    const info = PERMISSION_LABELS[p];
                    return (
                      <tr key={p} style={{ borderTop: "1px solid rgba(var(--border-rgb),0.08)" }}>
                        <td className="py-2 pr-3">
                          <div className="font-semibold" style={{ color: "var(--text)" }}>{info.tr}</div>
                          <div className="text-[0.74rem]" style={{ color: "var(--text-faint)" }}>{info.desc}</div>
                        </td>
                        {roles.map((r) => {
                          const on = perms.some((x) => x.role_id === r.id && x.permission_key === p);
                          return (
                            <td key={r.id} className="px-2 py-2 text-center" style={{ color: "var(--text)" }}>
                              {on ? "✓" : "·"}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-6 rounded-[22px] p-6" style={{ background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.09)" }}>
            <h2 className="font-display text-[1.2rem] font-bold" style={{ color: "var(--text)" }}>Kullanıcı rolleri</h2>
            <div className="mt-4 flex flex-col gap-3">
              {users.map((u) => {
                const mine = assignments.filter((a) => a.user_id === u.user_id && !a.scope_basket_id);
                return (
                  <div key={u.user_id} className="rounded-xl px-4 py-3" style={{ background: "var(--surface-2)" }}>
                    <div className="font-semibold" style={{ color: "var(--text)" }}>
                      {u.display_name || u.email || u.user_id}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {roles.map((r) => {
                        const has = mine.some((a) => a.role_id === r.id);
                        return (
                          <button
                            key={r.id}
                            disabled={busy}
                            onClick={() => void toggle(u.user_id, r.id, has)}
                            className="rounded-full px-3 py-1 text-[0.8rem] font-semibold transition disabled:opacity-40"
                            style={{
                              background: has ? "rgba(217,119,87,0.18)" : "transparent",
                              border: `1px solid ${has ? "#D97757" : "rgba(var(--border-rgb),0.12)"}`,
                              color: has ? "#D97757" : "var(--text-muted)",
                            }}
                          >
                            {r.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {!users.length && (
                <p style={{ color: "var(--text-muted)" }}>Henüz kullanıcı yok.</p>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
