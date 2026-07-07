"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { BrandIcon } from "@/components/BrandIcon";

export type SessionUser = { id: string; email: string; name: string };

type Ctx = { user: SessionUser | null; ready: boolean; signOut: () => void };
const SessionContext = createContext<Ctx>({ user: null, ready: false, signOut: () => {} });

export function useSession() {
  return useContext(SessionContext);
}

/** Geriye dönük uyumluluk: eski `useNameContext().name` = kullanıcı kimliği (iş e-postası). */
export function useNameContext() {
  const { user } = useSession();
  return { name: user?.email ?? "", setName: () => {} };
}

/** Dev fallback: Azure creds gelmeden local'de çalışmak için (NEXT_PUBLIC_AUTH_BYPASS=1). */
const BYPASS = process.env.NEXT_PUBLIC_AUTH_BYPASS === "1";
const DEV_KEY = "fikirsepeti:devuser";

function toUser(session: Session | null): SessionUser | null {
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
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (BYPASS) {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem(DEV_KEY) : null;
      if (raw) setUser(JSON.parse(raw) as SessionUser);
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setUser(toUser(data.session));
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUser(toUser(session)));
    return () => sub.subscription.unsubscribe();
  }, []);

  const loginAzure = () =>
    supabase.auth.signInWithOAuth({
      provider: "azure",
      options: { scopes: "email openid profile", redirectTo: window.location.origin },
    });

  const devLogin = () => {
    const clean = draft.trim();
    if (clean.length < 2) return;
    const email = clean.includes("@") ? clean.toLowerCase() : `${clean.toLowerCase()}@dev.local`;
    const u: SessionUser = { id: email, email, name: clean };
    window.localStorage.setItem(DEV_KEY, JSON.stringify(u));
    setUser(u);
  };

  const signOut = () => {
    if (BYPASS) {
      window.localStorage.removeItem(DEV_KEY);
      setUser(null);
    } else {
      void supabase.auth.signOut();
    }
  };

  return (
    <SessionContext.Provider value={{ user, ready, signOut }}>
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

              {BYPASS ? (
                <>
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && devLogin()}
                    placeholder="Adın ya da iş e-postan"
                    className="mt-6 w-full rounded-lg px-3.5 py-3 text-[0.95rem] outline-none"
                    style={{ background: "var(--surface-2)", border: "1px solid rgba(var(--border-rgb),0.09)", color: "var(--text)" }}
                  />
                  <button
                    onClick={devLogin}
                    disabled={draft.trim().length < 2}
                    className="mt-3 w-full rounded-full py-3 text-[0.95rem] font-semibold transition disabled:opacity-40"
                    style={{ background: "var(--text)", color: "var(--bg)" }}
                  >
                    Devam
                  </button>
                  <p className="mt-4 flex items-center justify-center gap-2 text-[0.8rem]" style={{ color: "var(--text-faint)" }}>
                    <MicrosoftMark /> Microsoft ile giriş yakında
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
