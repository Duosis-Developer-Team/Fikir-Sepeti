"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { BrandIcon } from "@/components/BrandIcon";
import { DEV_AUTH_PASSWORD } from "@/lib/dev-auth";

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
};
const SessionContext = createContext<Ctx>({
  user: null,
  ready: false,
  signOut: () => {},
  tenantDenied: false,
});

export function useSession() {
  return useContext(SessionContext);
}

/** Geriye dönük uyumluluk: eski `useNameContext().name` = kullanıcı kimliği (iş e-postası). */
export function useNameContext() {
  const { user } = useSession();
  return { name: user?.email ?? "", setName: () => {}, tenantId: user?.tenantId ?? null };
}

/** Dev fallback: SADECE localhost'ta + NEXT_PUBLIC_AUTH_BYPASS=1 ise aktif. Prod domainde asla → gerçek Azure girişi. */
function isDevBypass(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NEXT_PUBLIC_AUTH_BYPASS !== "1") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}

async function resolveTenantIdForEmail(email: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("resolve_tenant_id_for_email", {
    p_email: email,
  });
  if (error) {
    console.error("resolve_tenant_id_for_email", error);
    return null;
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
  email: string
): Promise<{ tenantId: string | null; denied: boolean }> {
  const tenantId = await resolveTenantIdForEmail(email);
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

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [bypass, setBypass] = useState(false);
  const [draft, setDraft] = useState("");
  const [tenantDenied, setTenantDenied] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    const b = isDevBypass();
    setBypass(b);

    supabase.auth.getSession().then(async ({ data }) => {
      const base = toUserBase(data.session);
      if (!base) {
        setReady(true);
        return;
      }
      const { tenantId, denied } = await bindAfterAuth(base.email);
      setTenantDenied(denied);
      setUser(tenantId ? { ...base, tenantId } : null);
      setReady(true);
    });

    if (typeof window !== "undefined" && window.location.hash.includes("access_token")) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, session) => {
      const base = toUserBase(session);
      if (!base) {
        setUser(null);
        return;
      }
      const { tenantId, denied } = await bindAfterAuth(base.email);
      setTenantDenied(denied);
      setUser(tenantId ? { ...base, tenantId } : null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const loginAzure = () =>
    supabase.auth.signInWithOAuth({
      provider: "azure",
      options: { scopes: "email openid profile", redirectTo: window.location.origin },
    });

  const devLogin = async () => {
    const clean = draft.trim();
    if (clean.length < 2) return;
    const email = clean.includes("@") ? clean.toLowerCase() : `${clean.toLowerCase()}@duosis.dev`;
    setLoginError(null);

    const tenantIdPre = await resolveTenantIdForEmail(email);
    if (!tenantIdPre) {
      setTenantDenied(true);
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
    const { tenantId, denied } = await bindAfterAuth(base.email);
    setTenantDenied(denied);
    setUser(tenantId ? { ...base, name: clean, tenantId } : null);
  };

  const signOut = () => {
    void supabase.auth.signOut();
    setUser(null);
    setTenantDenied(false);
  };

  return (
    <SessionContext.Provider value={{ user, ready, signOut, tenantDenied }}>
      {children}
      <AnimatePresence>
        {ready && !user && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center px-6"
            style={{ background: "rgba(24,24,24,0.92)", backdropFilter: "blur(6px)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-sm rounded-[22px] p-8"
              style={{ background: "var(--card)", border: "1px solid rgba(var(--border-rgb),0.09)" }}
              initial={{ scale: 0.96, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            >
              <BrandIcon size="md" priority />
              <h1 className="font-display mt-5 text-[1.5rem] font-bold tracking-tight" style={{ color: "var(--text)" }}>Fikir Sepeti</h1>
              <p className="mt-1.5 text-[0.92rem]" style={{ color: "var(--text-muted)" }}>
                İş e-postanla giriş yap. Oyların, fikirlerin ve takımların hesabına bağlanır.
              </p>
              {tenantDenied && (
                <p className="mt-3 rounded-lg px-3 py-2 text-[0.85rem]" style={{ background: "rgba(242,121,95,0.12)", color: "#F2795F" }}>
                  Bu e-posta için tanımsız tenant. Erişim reddedildi.
                </p>
              )}
              {loginError && (
                <p className="mt-3 rounded-lg px-3 py-2 text-[0.85rem]" style={{ background: "rgba(242,121,95,0.12)", color: "#F2795F" }}>
                  {loginError}
                </p>
              )}

              {bypass ? (
                <>
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void devLogin()}
                    placeholder="Adın ya da iş e-postan"
                    className="mt-6 w-full rounded-lg px-3.5 py-3 text-[0.95rem] outline-none"
                    style={{ background: "var(--surface-2)", border: "1px solid rgba(var(--border-rgb),0.09)", color: "var(--text)" }}
                  />
                  <button
                    onClick={() => void devLogin()}
                    disabled={draft.trim().length < 2}
                    className="mt-3 w-full rounded-full py-3 text-[0.95rem] font-semibold transition disabled:opacity-40"
                    style={{ background: "var(--text)", color: "var(--bg)" }}
                  >
                    Devam
                  </button>
                  <p className="mt-4 text-center text-[0.8rem]" style={{ color: "var(--text-faint)" }}>
                    Yerel: seed kullanıcı + JWT (RLS)
                  </p>
                </>
              ) : (
                <button
                  onClick={loginAzure}
                  className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-full py-3 text-[0.95rem] font-semibold transition hover:opacity-90"
                  style={{ background: "var(--text)", color: "var(--bg)" }}
                >
                  <MicrosoftMark /> Microsoft ile giriş
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </SessionContext.Provider>
  );
}

function MicrosoftMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 21 21" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}
