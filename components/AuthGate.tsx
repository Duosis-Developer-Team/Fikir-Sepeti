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
  /** Email+password sign-up / sign-in for /register. */
  registerWithPassword: (email: string, password: string) => Promise<void>;
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
  registerWithPassword: async () => {},
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
  await supabase.from("app_users").upsert(
    {
      tenant_id: tenantId,
      user_id: email,
      email,
      display_name: email.split("@")[0],
    },
    { onConflict: "tenant_id,user_id" }
  );
  const { data: mem } = await supabase
    .from("roles")
    .select("id")
    .eq("key", "member")
    .is("tenant_id", null)
    .maybeSingle();
  if (!mem) return;
  const { data: existing } = await supabase
    .from("user_roles")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("user_id", email)
    .eq("role_id", mem.id)
    .is("scope_basket_id", null)
    .maybeSingle();
  if (!existing) {
    await supabase.from("user_roles").insert({
      tenant_id: tenantId,
      user_id: email,
      role_id: mem.id,
      scope_basket_id: null,
    });
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
    const azureTid = azureTenantIdFromUser(session?.user);
    const { tenantId, denied } = await bindAfterAuth(base.email, azureTid);
    setTenantDenied(denied);
    setDeniedEmail(denied ? base.email : null);
    // Keep session identity even without a tenant (SG2 onboarding).
    setUser({ ...base, tenantId });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      await applySession(data.session);
      setReady(true);
    });

    if (typeof window !== "undefined" && window.location.hash.includes("access_token")) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, session) => {
      await applySession(session);
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

  const registerWithPassword = async (email: string, password: string) => {
    setLoginError(null);
    setTenantDenied(false);
    setDeniedEmail(null);
    try {
      const session = await ensurePasswordSession(email.trim(), password);
      await applySession(session);
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
    registerWithPassword,
    createWorkspace,
    joinWithInvite,
    clearLoginError,
    refreshBinding,
  };

  const showApp =
    ready &&
    (!!user || isPublicPath(pathname) || (needsWorkspace && pathname === REGISTER_PATH));

  return (
    <SessionContext.Provider value={value}>
      {showApp ? children : null}
    </SessionContext.Provider>
  );
}
