"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandIcon } from "@/components/BrandIcon";
import { useSession } from "@/components/AuthGate";
import { supabase } from "@/lib/supabase";
import {
  normalizeDomainInput,
  normalizeInviteCode,
  routeAfterPeek,
} from "@/lib/register";

type Step = "account" | "choose" | "create" | "invite";

export default function RegisterPage() {
  const {
    ready,
    user,
    bypass,
    needsWorkspace,
    loginError,
    loginAzure,
    registerWithPassword,
    createWorkspace,
    joinWithInvite,
    clearLoginError,
    signOut,
  } = useSession();

  const [step, setStep] = useState<Step>("account");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [domain, setDomain] = useState("");
  const [invite, setInvite] = useState("");
  const [domainTenant, setDomainTenant] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (needsWorkspace) setStep("choose");
  }, [needsWorkspace]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6" style={{ background: "var(--bg)" }}>
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>
          Yükleniyor…
        </p>
      </div>
    );
  }

  if (user?.tenantId) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6" style={{ background: "var(--bg)" }}>
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>
          Yönlendiriliyor…
        </p>
      </div>
    );
  }

  const err = localError || loginError;

  const onAccountContinue = async () => {
    setLocalError(null);
    clearLoginError();
    const clean = email.trim().toLowerCase();
    if (!clean.includes("@") || password.length < 6) {
      setLocalError("Geçerli e-posta ve en az 6 karakter şifre gerekli.");
      return;
    }
    setBusy(true);
    try {
      const { data: peekRows } = await supabase.rpc("peek_tenant_for_email", {
        p_email: clean,
      });
      const row = Array.isArray(peekRows) ? peekRows[0] : peekRows;
      const route = routeAfterPeek(
        row
          ? {
              tenant_id: (row as { tenant_id: string }).tenant_id,
              tenant_name: (row as { tenant_name: string }).tenant_name,
              via: (row as { via: string }).via,
            }
          : null
      );
      if (route.kind === "join_domain") {
        setDomainTenant(route.tenantName);
      } else {
        setDomainTenant(null);
      }
      await registerWithPassword(clean, password);
      setStep(route.kind === "join_domain" ? "choose" : "choose");
      // Domain match: AuthGate bindAfterAuth should already attach tenant → redirect home.
      // If still needs workspace, choose step shows.
    } catch {
      /* loginError set */
    } finally {
      setBusy(false);
    }
  };

  const onCreate = async () => {
    setLocalError(null);
    clearLoginError();
    const name = workspaceName.trim();
    if (name.length < 2) {
      setLocalError("Çalışma alanı adı gerekli.");
      return;
    }
    const dom = normalizeDomainInput(domain);
    if (domain.trim() && !dom) {
      setLocalError("Domain geçersiz (ör. sirket.com).");
      return;
    }
    setBusy(true);
    try {
      await createWorkspace(name, dom);
    } catch {
      /* handled */
    } finally {
      setBusy(false);
    }
  };

  const onInvite = async () => {
    setLocalError(null);
    clearLoginError();
    const code = normalizeInviteCode(invite);
    if (code.length < 6) {
      setLocalError("Davet kodu eksik.");
      return;
    }
    setBusy(true);
    try {
      await joinWithInvite(code);
    } catch {
      /* handled */
    } finally {
      setBusy(false);
    }
  };

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
        <p className="mt-1.5 text-[0.92rem]" style={{ color: "var(--text-muted)" }}>
          {step === "account" && "Hesap oluştur; domain eşleşirse otomatik katılır, yoksa çalışma alanı açarsın."}
          {step === "choose" &&
            (domainTenant
              ? `“${domainTenant}” alanına katılmaya hazırsın — veya kendi alanını oluştur.`
              : "Çalışma alanı oluştur veya davet koduyla katıl.")}
          {step === "create" && "Yeni çalışma alanı — domain isteğe bağlı."}
          {step === "invite" && "Tenant admin’in verdiği davet kodunu gir."}
        </p>

        {err && (
          <p
            className="mt-3 rounded-lg px-3 py-2 text-[0.85rem]"
            style={{ background: "rgba(242,121,95,0.12)", color: "#F2795F" }}
            role="alert"
          >
            {err}
          </p>
        )}

        {step === "account" && (
          <>
            <input
              autoFocus
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="iş e-postan"
              className="mt-6 w-full rounded-lg px-3.5 py-3 text-[0.95rem] outline-none"
              style={{
                background: "var(--surface-2)",
                border: "1px solid rgba(var(--border-rgb),0.09)",
                color: "var(--text)",
              }}
              disabled={busy}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void onAccountContinue()}
              placeholder="şifre (en az 6 karakter)"
              className="mt-3 w-full rounded-lg px-3.5 py-3 text-[0.95rem] outline-none"
              style={{
                background: "var(--surface-2)",
                border: "1px solid rgba(var(--border-rgb),0.09)",
                color: "var(--text)",
              }}
              disabled={busy}
            />
            <button
              type="button"
              onClick={() => void onAccountContinue()}
              disabled={busy}
              className="mt-3 w-full rounded-full py-3 text-[0.95rem] font-semibold transition disabled:opacity-40"
              style={{ background: "var(--text)", color: "var(--bg)" }}
            >
              {busy ? "…" : "Devam"}
            </button>
            {!bypass && (
              <button
                type="button"
                onClick={loginAzure}
                className="mt-3 w-full rounded-full py-3 text-[0.9rem] font-semibold transition hover:opacity-90"
                style={{
                  border: "1px solid rgba(var(--border-rgb),0.18)",
                  color: "var(--text)",
                }}
              >
                Microsoft ile devam
              </button>
            )}
          </>
        )}

        {step === "choose" && needsWorkspace && (
          <div className="mt-6 flex flex-col gap-3">
            {user?.email && (
              <p className="text-[0.85rem]" style={{ color: "var(--text-muted)" }}>
                Hesap: <span style={{ color: "var(--text-2)" }}>{user.email}</span>
              </p>
            )}
            <button
              type="button"
              onClick={() => setStep("create")}
              className="w-full rounded-full py-3 text-[0.95rem] font-semibold"
              style={{ background: "var(--clay)", color: "#161616" }}
            >
              Çalışma alanı oluştur
            </button>
            <button
              type="button"
              onClick={() => setStep("invite")}
              className="w-full rounded-full py-3 text-[0.95rem] font-semibold"
              style={{
                border: "1px solid rgba(var(--border-rgb),0.18)",
                color: "var(--text)",
              }}
            >
              Davet koduyla katıl
            </button>
            <button
              type="button"
              onClick={signOut}
              className="text-[0.85rem] font-medium"
              style={{ color: "var(--text-faint)" }}
            >
              Çıkış yap
            </button>
          </div>
        )}

        {step === "create" && (
          <>
            <input
              autoFocus
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="Çalışma alanı adı"
              className="mt-6 w-full rounded-lg px-3.5 py-3 text-[0.95rem] outline-none"
              style={{
                background: "var(--surface-2)",
                border: "1px solid rgba(var(--border-rgb),0.09)",
                color: "var(--text)",
              }}
              disabled={busy}
            />
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="Domain (opsiyonel) — örn. sirket.com"
              className="mt-3 w-full rounded-lg px-3.5 py-3 text-[0.95rem] outline-none"
              style={{
                background: "var(--surface-2)",
                border: "1px solid rgba(var(--border-rgb),0.09)",
                color: "var(--text)",
              }}
              disabled={busy}
            />
            <button
              type="button"
              onClick={() => void onCreate()}
              disabled={busy}
              className="mt-3 w-full rounded-full py-3 text-[0.95rem] font-semibold disabled:opacity-40"
              style={{ background: "var(--text)", color: "var(--bg)" }}
            >
              {busy ? "Oluşturuluyor…" : "Oluştur"}
            </button>
            <button
              type="button"
              onClick={() => setStep("choose")}
              className="mt-3 w-full text-[0.85rem]"
              style={{ color: "var(--text-faint)" }}
            >
              ← Geri
            </button>
          </>
        )}

        {step === "invite" && (
          <>
            <input
              autoFocus
              value={invite}
              onChange={(e) => setInvite(e.target.value)}
              placeholder="Davet kodu"
              className="mt-6 w-full rounded-lg px-3.5 py-3 text-[0.95rem] uppercase outline-none tracking-widest"
              style={{
                background: "var(--surface-2)",
                border: "1px solid rgba(var(--border-rgb),0.09)",
                color: "var(--text)",
              }}
              disabled={busy}
            />
            <button
              type="button"
              onClick={() => void onInvite()}
              disabled={busy}
              className="mt-3 w-full rounded-full py-3 text-[0.95rem] font-semibold disabled:opacity-40"
              style={{ background: "var(--text)", color: "var(--bg)" }}
            >
              {busy ? "…" : "Katıl"}
            </button>
            <button
              type="button"
              onClick={() => setStep("choose")}
              className="mt-3 w-full text-[0.85rem]"
              style={{ color: "var(--text-faint)" }}
            >
              ← Geri
            </button>
          </>
        )}

        <Link
          href="/login"
          className="mt-5 block text-center text-[0.85rem] font-medium"
          style={{ color: "var(--text-faint)" }}
        >
          Zaten hesabın var mı? Giriş
        </Link>
      </div>
    </div>
  );
}
