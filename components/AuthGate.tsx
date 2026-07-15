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
  bypass: boolean;
  loginAzure: () => void;
  devLogin: (draft: string) => Promise<void>;
  clearLoginError: () => void;
};

const SessionContext = createContext<Ctx>({
  user: null,
  ready: false,
  signOut: () => {},
  tenantDenied: false,
  deniedEmail: null,
  loginError: null,
  bypass: false,
  loginAzure: () => {},
  devLogin: async () => {},
  clearLoginError: () => {},
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
    // Fallback for DBs that have not applied 0007 yet
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
  const email = u.email ?? "";
  const meta = u.user_metadata ?? {};
  const name = (meta.name as string) || (meta.full_name as string) || email;
  return { id: u.id, email, name };
}

const LOGIN_PATH = "/login";

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
      return;
    }
    const azureTid = azureTenantIdFromUser(session?.user);
    const { tenantId, denied } = await bindAfterAuth(base.email, azureTid);
    setTenantDenied(denied);
    setDeniedEmail(denied ? base.email : null);
    setUser(tenantId ? { ...base, tenantId } : null);
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

  // Redirect: unauthenticated → /login; authenticated on /login → /
  useEffect(() => {
    if (!ready) return;
    if (!user && pathname !== LOGIN_PATH) {
      router.replace(LOGIN_PATH);
      return;
    }
    if (user && pathname === LOGIN_PATH) {
      router.replace("/");
    }
  }, [ready, user, pathname, router]);

  const loginAzure = () => {
    setLoginError(null);
    void supabase.auth.signInWithOAuth({
      provider: "azure",
      options: { scopes: "email openid profile", redirectTo: window.location.origin },
    });
  };

  const devLogin = async (draft: string) => {
    const clean = draft.trim();
    if (clean.length < 2) return;
    const email = clean.includes("@") ? clean.toLowerCase() : `${clean.toLowerCase()}@duosis.dev`;
    setLoginError(null);
    setTenantDenied(false);
    setDeniedEmail(null);

    const tenantIdPre = await resolveTenantForClaims(email, null);
    if (!tenantIdPre) {
      setTenantDenied(true);
      setDeniedEmail(email);
      setUser(null);
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: DEV_AUTH_PASSWORD,
    });
    if (error || !data.session) {
      setLoginError(error?.message ?? "Giriş başarısız — seed kullanıcı mı?");
      return;
    }

    const base = toUserBase(data.session);
    if (!base) return;
    const azureTid = azureTenantIdFromUser(data.session.user);
    const { tenantId, denied } = await bindAfterAuth(base.email, azureTid);
    setTenantDenied(denied);
    setDeniedEmail(denied ? base.email : null);
    setUser(tenantId ? { ...base, name: clean, tenantId } : null);
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
    bypass,
    loginAzure,
    devLogin,
    clearLoginError,
  };

  // While redirecting away from protected routes, render nothing for content
  const onLogin = pathname === LOGIN_PATH;
  const showApp = ready && (!!user || onLogin);

  return (
    <SessionContext.Provider value={value}>
      {showApp ? children : null}
    </SessionContext.Provider>
  );
}
