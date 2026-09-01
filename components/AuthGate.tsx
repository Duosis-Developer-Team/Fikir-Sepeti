"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { BrandIcon } from "@/components/BrandIcon";
import { supabase } from "@/lib/supabase";
import { DEV_AUTH_PASSWORD } from "@/lib/dev-auth";
import { azureTenantIdFromUser } from "@/lib/azure-claims";
import { isPublicPath } from "@/lib/public-paths";
import { normalizeInviteCode } from "@/lib/register";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  tenantId: string | null;
};

type Ctx = {
  user: SessionUser | null;
  ready: boolean;
  signOut: () => void;
  tenantDenied: boolean;
  deniedEmail: string | null;
  loginError: string | null;
  needsWorkspace: boolean;
  bypass: boolean;
  loginAzure: () => void;
  /** Bypass/dev password login (seed or known domain). */
  devLogin: (draft: string) => Promise<void>;
  /** Email+password sign-in for /login. Never falls back to signUp. */
  loginWithPassword: (email: string, password: string) => Promise<void>;
  /** Sends a password-reset email via Supabase. */
  requestPasswordReset: (email: string) => Promise<void>;
  /** Email+password sign-up / sign-in for /register. */
  registerWithPassword: (email: string, password: string) => Promise<void>;
  /** True right after signUp when Supabase requires email confirmation. */
  needsConfirmation: boolean;
  confirmationEmail: string | null;
  resendConfirmation: () => Promise<void>;
  clearNeedsConfirmation: () => void;
  createWorkspace: (name: string, domain?: string | null) => Promise<void>;
  joinWithInvite: (code: string) => Promise<void>;
  clearLoginError: () => void;
  refreshBinding: () => Promise<void>;
};

const SessionContext = createContext<Ctx>({
  user: null,
  ready: false,
  signOut: () => {},
  tenantDenied: false,
  deniedEmail: null,
  loginError: null,
  needsWorkspace: false,
  bypass: false,
  loginAzure: () => {},
  devLogin: async () => {},
  loginWithPassword: async () => {},
  requestPasswordReset: async () => {},
  registerWithPassword: async () => {},
  needsConfirmation: false,
  confirmationEmail: null,
  resendConfirmation: async () => {},
  clearNeedsConfirmation: () => {},
  createWorkspace: async () => {},
  joinWithInvite: async () => {},
  clearLoginError: () => {},
  refreshBinding: async () => {},
});

export function useSession() {
  return useContext(SessionContext);
}

/** Back-compat: old `useNameContext().name` = user identity (work email). */
export function useNameContext() {
  const { user } = useSession();
  return { name: user?.email ?? "", setName: () => {}, tenantId: user?.tenantId ?? null };
}

/** Dev fallback: ONLY on localhost + NEXT_PUBLIC_AUTH_BYPASS=1. Never on prod domain. */
export function isDevBypass(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NEXT_PUBLIC_AUTH_BYPASS !== "1") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}

async function resolveTenantForClaims(
  email: string,
  azureTid: string | null
): Promise<string | null> {
  const { data, error } = await supabase.rpc("resolve_tenant_for_claims", {
    p_email: email,
    p_azure_tid: azureTid,
  });
  if (error) {
    console.warn("resolve_tenant_for_claims", error);
    const legacy = await supabase.rpc("resolve_tenant_id_for_email", {
      p_email: email,
    });
    if (legacy.error) {
      console.error("resolve_tenant_id_for_email", legacy.error);
      return null;
    }
    return (legacy.data as string | null) ?? null;
  }
  return (data as string | null) ?? null;
}

async function ensureMembership(email: string, tenantId: string) {
  const { error } = await supabase.rpc("ensure_app_membership", {
    p_email: email.toLowerCase(),
    p_tenant_id: tenantId,
  });
  if (error) {
    console.error("ensure_app_membership", error);
    // Fallback for DBs without 0012 (best-effort; may fail under RLS)
    await supabase.from("app_users").upsert(
      {
        tenant_id: tenantId,
        user_id: email.toLowerCase(),
        email: email.toLowerCase(),
        display_name: email.split("@")[0],
      },
      { onConflict: "tenant_id,user_id" }
    );
  }
}

async function bindAfterAuth(
  email: string,
  azureTid: string | null
): Promise<{ tenantId: string | null; denied: boolean }> {
  const tenantId = await resolveTenantForClaims(email, azureTid);
  if (!tenantId) return { tenantId: null, denied: true };
  await ensureMembership(email, tenantId);
  return { tenantId, denied: false };
}

function toUserBase(session: Session | null): Omit<SessionUser, "tenantId"> | null {
  const u = session?.user;
  if (!u) return null;
  const email = (u.email ?? "").toLowerCase();
  const meta = u.user_metadata ?? {};
  const name = (meta.name as string) || (meta.full_name as string) || email;
  return { id: u.id, email, name };
}

const LOGIN_PATH = "/login";
const REGISTER_PATH = "/register";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const bypass = typeof window !== "undefined" && isDevBypass();
  const [tenantDenied, setTenantDenied] = useState(false);
  const [deniedEmail, setDeniedEmail] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  const applySession = useCallback(async (session: Session | null) => {
    const base = toUserBase(session);
    if (!base) {
      setUser(null);
      setTenantDenied(false);
      setDeniedEmail(null);
      return;
    }
    setNeedsConfirmation(false);
    setConfirmationEmail(null);
    const azureTid = azureTenantIdFromUser(session?.user);
    const { tenantId, denied } = await bindAfterAuth(base.email, azureTid);
    setTenantDenied(denied);
    setDeniedEmail(denied ? base.email : null);
    // Keep session identity even without a tenant (SG2 onboarding).
    setUser({ ...base, tenantId });
  }, []);

  useEffect(() => {
    let settled = false;
    const markReady = () => {
      if (settled) return;
      settled = true;
      setReady(true);
    };

    // Safety net: a hung request (cold-starting DB, dead connection) should
    // never leave the app stuck on the loading skeleton forever.
    const timeout = setTimeout(markReady, 8000);

    // Microsoft OAuth dönüşünde (redirectTo=origin) URL'de "#access_token=..." olur.
    // Supabase istemcisi bunu kendi içinde işleyip session'ı localStorage'a yazar ve
    // onAuthStateChange'i tetikler — ama bu asenkron. Burada AYRICA getSession()
    // çağırıp onun ilk (henüz token işlenmeden dönen) sonucuna göre "ready"i
    // işaretlemek, token henüz kaydedilmeden "giriş yok" sanılmasına yol açıyordu:
    // kullanıcı Microsoft'tan yeni dönmüşken oturumsuz görünüyor, F5'te ise token
    // artık localStorage'da olduğu için sorunsuz giriyordu (rapor edilen bug).
    // Çözüm: tek doğruluk kaynağı onAuthStateChange — bu her zaman Supabase'in kendi
    // URL/token işlemesinden SONRA tetiklenir, ilk tetiklendiğinde "ready" işaretlenir.
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, session) => {
      await applySession(session);
      clearTimeout(timeout);
      markReady();
    });
    return () => sub.subscription.unsubscribe();
  }, [applySession]);

  const needsWorkspace = !!user && !user.tenantId;

  useEffect(() => {
    if (!ready) return;
    if (!user && !isPublicPath(pathname)) {
      router.replace(LOGIN_PATH);
      return;
    }
    if (needsWorkspace && pathname !== REGISTER_PATH) {
      router.replace(REGISTER_PATH);
      return;
    }
    if (user?.tenantId && (pathname === LOGIN_PATH || pathname === REGISTER_PATH)) {
      router.replace("/");
    }
  }, [ready, user, needsWorkspace, pathname, router]);

  const loginAzure = () => {
    setLoginError(null);
    void supabase.auth.signInWithOAuth({
      provider: "azure",
      options: { scopes: "email openid profile", redirectTo: window.location.origin },
    });
  };

  const refreshBinding = async () => {
    const { data } = await supabase.auth.getSession();
    await applySession(data.session);
  };

  const ensurePasswordSession = async (email: string, password: string) => {
    const lower = email.toLowerCase();
    const first = await supabase.auth.signInWithPassword({ email: lower, password });
    if (first.data.session) return first.data.session;
    const { error: upErr } = await supabase.auth.signUp({
      email: lower,
      password,
      options: { data: { name: lower.split("@")[0] } },
    });
    if (upErr && !/already|registered/i.test(upErr.message)) {
      throw new Error(upErr.message);
    }
    const second = await supabase.auth.signInWithPassword({ email: lower, password });
    if (!second.data.session) {
      throw new Error(second.error?.message ?? "Giriş başarısız");
    }
    return second.data.session;
  };

  /** /login only — never falls back to signUp (a wrong password must not silently create a new account). */
  const loginWithPassword = async (email: string, password: string) => {
    setLoginError(null);
    setTenantDenied(false);
    setDeniedEmail(null);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error || !data.session) {
      const message = /email not confirmed/i.test(error?.message ?? "")
        ? "E-posta adresini henüz onaylamadın. Gelen kutunu kontrol et."
        : "E-posta veya şifre hatalı.";
      setLoginError(message);
      throw new Error(message);
    }
    await applySession(data.session);
  };

  const requestPasswordReset = async (email: string) => {
    await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: typeof window !== "undefined" ? `${window.location.origin}/login` : undefined,
    });
  };

  const clearNeedsConfirmation = () => {
    setNeedsConfirmation(false);
    setConfirmationEmail(null);
  };

  const resendConfirmation = async () => {
    if (!confirmationEmail) return;
    await supabase.auth.resend({
      type: "signup",
      email: confirmationEmail,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? `${window.location.origin}/register?confirmed=1` : undefined,
      },
    });
  };

  const registerWithPassword = async (email: string, password: string) => {
    setLoginError(null);
    setTenantDenied(false);
    setDeniedEmail(null);
    setNeedsConfirmation(false);
    setConfirmationEmail(null);
    const lower = email.trim().toLowerCase();
    try {
      // Resubmitting the form with an existing, already-confirmed account just signs in.
      const first = await supabase.auth.signInWithPassword({ email: lower, password });
      if (first.data.session) {
        await applySession(first.data.session);
        return;
      }
      const { data: signUpData, error: upErr } = await supabase.auth.signUp({
        email: lower,
        password,
        options: {
          data: { name: lower.split("@")[0] },
          emailRedirectTo: `${window.location.origin}/register?confirmed=1`,
        },
      });
      if (upErr) {
        if (/already|registered/i.test(upErr.message)) {
          throw new Error("Bu e-posta ile zaten bir hesap var. Şifreni mi unuttun?");
        }
        throw new Error(upErr.message);
      }
      if (signUpData.session) {
        await applySession(signUpData.session);
        return;
      }
      // Newer Supabase versions return no error for an already-registered email
      // (anti-enumeration) but flag it via an empty identities array.
      if (signUpData.user && signUpData.user.identities?.length === 0) {
        throw new Error("Bu e-posta ile zaten bir hesap var. Şifreni mi unuttun?");
      }
      // signUp succeeded but no session => "Confirm email" is on in Supabase; wait for the link.
      setNeedsConfirmation(true);
      setConfirmationEmail(lower);
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : "Kayıt başarısız");
      throw e;
    }
  };

  const createWorkspace = async (name: string, domain?: string | null) => {
    setLoginError(null);
    const email = user?.email;
    if (!email) {
      setLoginError("Önce hesap oluştur");
      throw new Error("no session");
    }
    const { data, error } = await supabase.rpc("create_tenant_for_user", {
      p_name: name,
      p_domain: domain ?? null,
      p_email: email,
    });
    if (error) {
      setLoginError(error.message);
      throw error;
    }
    if (!data) {
      setLoginError("Çalışma alanı oluşturulamadı");
      throw new Error("no tenant");
    }
    await applySession((await supabase.auth.getSession()).data.session);
  };

  const joinWithInvite = async (code: string) => {
    setLoginError(null);
    const email = user?.email;
    if (!email) {
      setLoginError("Önce hesap oluştur");
      throw new Error("no session");
    }
    const { data, error } = await supabase.rpc("join_tenant_by_invite", {
      p_code: normalizeInviteCode(code),
      p_email: email,
    });
    if (error) {
      setLoginError(error.message);
      throw error;
    }
    if (!data) {
      setLoginError("Davet geçersiz");
      throw new Error("no tenant");
    }
    await applySession((await supabase.auth.getSession()).data.session);
  };

  const devLogin = async (draft: string) => {
    const clean = draft.trim();
    if (clean.length < 2) return;
    const email = clean.includes("@") ? clean.toLowerCase() : `${clean.toLowerCase()}@duosis.dev`;
    setLoginError(null);
    setTenantDenied(false);
    setDeniedEmail(null);

    try {
      const session = await ensurePasswordSession(email, DEV_AUTH_PASSWORD);
      const base = toUserBase(session);
      if (!base) return;
      const azureTid = azureTenantIdFromUser(session.user);
      const { tenantId, denied } = await bindAfterAuth(base.email, azureTid);
      setTenantDenied(denied);
      setDeniedEmail(denied ? base.email : null);
      setUser({ ...base, name: clean.includes("@") ? base.name : clean, tenantId });
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : "Giriş başarısız — seed kullanıcı mı?");
    }
  };

  const signOut = () => {
    void supabase.auth.signOut();
    setUser(null);
    setTenantDenied(false);
    setDeniedEmail(null);
    setLoginError(null);
  };

  const clearLoginError = () => setLoginError(null);

  const value: Ctx = {
    user,
    ready,
    signOut,
    tenantDenied,
    deniedEmail,
    loginError,
    needsWorkspace,
    bypass,
    loginAzure,
    devLogin,
    loginWithPassword,
    requestPasswordReset,
    registerWithPassword,
    needsConfirmation,
    confirmationEmail,
    resendConfirmation,
    clearNeedsConfirmation,
    createWorkspace,
    joinWithInvite,
    clearLoginError,
    refreshBinding,
  };

  const showApp =
    !!user || isPublicPath(pathname) || (needsWorkspace && pathname === REGISTER_PATH);

  return (
    <SessionContext.Provider value={value}>
      {!ready ? <AuthLoadingSkeleton /> : showApp ? children : null}
    </SessionContext.Provider>
  );
}

/** Oturum kontrolü sürerken gösterilir — app/loading.tsx ile aynı görsel dil, boş ekran yok. */
function AuthLoadingSkeleton() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6 text-text">
      <div className="flex flex-col items-center gap-4">
        <BrandIcon size="lg" priority className="animate-pulse" />
        <p className="text-sm font-medium text-text-muted">Sepet hazırlanıyor…</p>
      </div>
    </main>
  );
}
