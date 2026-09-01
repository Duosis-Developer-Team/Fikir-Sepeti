"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BrandIcon } from "@/components/BrandIcon";
import { useSession } from "@/components/AuthGate";

const EASE = [0.22, 0.85, 0.25, 1] as const;
type PwStep = "email" | "password";

export default function LoginPage() {
  const {
    ready,
    user,
    bypass,
    tenantDenied,
    deniedEmail,
    loginError,
    loginAzure,
    loginWithPassword,
    requestPasswordReset,
    devLogin,
    signOut,
    clearLoginError,
  } = useSession();
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<PwStep>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  if (!ready || user?.tenantId) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6" style={{ background: "var(--bg)" }}>
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>
          Yükleniyor…
        </p>
      </div>
    );
  }

  const onDevSubmit = async () => {
    if (draft.trim().length < 2 || submitting) return;
    setSubmitting(true);
    clearLoginError();
    try {
      await devLogin(draft);
    } finally {
      setSubmitting(false);
    }
  };

  const onPasswordLogin = async () => {
    if (!email.includes("@") || !password || submitting) return;
    setSubmitting(true);
    clearLoginError();
    setResetMsg(null);
    try {
      await loginWithPassword(email, password);
    } catch {
      /* loginError set */
    } finally {
      setSubmitting(false);
    }
  };

  const onForgotPassword = async () => {
    if (!email.includes("@")) {
      setResetMsg("Önce e-posta adresini yaz.");
      return;
    }
    setResetMsg(null);
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      setResetMsg("Şifre sıfırlama linki gönderildi — gelen kutunu kontrol et.");
    } finally {
      setSubmitting(false);
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
          Fikir Sepeti
        </h1>
        <p className="mt-1.5 text-[0.92rem]" style={{ color: "var(--text-muted)" }}>
          İş e-postanla giriş yap. Oyların, fikirlerin ve takımların hesabına bağlanır.
        </p>

        {tenantDenied && (
          <div
            className="mt-4 rounded-lg px-3 py-3 text-[0.85rem]"
            style={{ background: "rgba(242,121,95,0.12)", color: "#F2795F" }}
            role="alert"
          >
            <p className="font-semibold">Bu e-posta için tanımlı çalışma alanı yok.</p>
            {deniedEmail && (
              <p className="mt-1 opacity-90" style={{ color: "var(--text-2)" }}>
                Giriş denenen: <span className="font-medium">{deniedEmail}</span>
              </p>
            )}
            <p className="mt-2 text-[0.8rem]" style={{ color: "var(--text-muted)" }}>
              Domain&apos;iniz kayıtlı değil. Çalışma alanı oluşturabilir veya davet koduyla katılabilirsin.
            </p>
            <a
              href="/register"
              className="mt-3 flex w-full items-center justify-center rounded-full py-2 text-[0.85rem] font-semibold transition hover:opacity-90"
              style={{ background: "var(--clay)", color: "#161616" }}
            >
              Kayıt / çalışma alanı
            </a>
            <button
              type="button"
              onClick={signOut}
              className="mt-2 w-full rounded-full py-2 text-[0.85rem] font-semibold transition hover:opacity-90"
              style={{ background: "rgba(242,121,95,0.2)", color: "#F2795F" }}
            >
              Çıkış yap / farklı hesap dene
            </button>
          </div>
        )}

        {loginError && (
          <p
            className="mt-3 rounded-lg px-3 py-2 text-[0.85rem]"
            style={{ background: "rgba(242,121,95,0.12)", color: "#F2795F" }}
            role="alert"
          >
            {loginError}
          </p>
        )}
        {resetMsg && (
          <p className="mt-3 text-[0.82rem]" style={{ color: "var(--text-muted)" }}>
            {resetMsg}
          </p>
        )}

        {bypass ? (
          <>
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void onDevSubmit()}
              placeholder="Adın ya da iş e-postan"
              className="mt-6 w-full rounded-lg px-3.5 py-3 text-[0.95rem] outline-none"
              style={{
                background: "var(--surface-2)",
                border: "1px solid rgba(var(--border-rgb),0.09)",
                color: "var(--text)",
              }}
              disabled={submitting}
            />
            <button
              type="button"
              onClick={() => void onDevSubmit()}
              disabled={draft.trim().length < 2 || submitting}
              className="mt-3 w-full rounded-full py-3 text-[0.95rem] font-semibold transition disabled:opacity-40"
              style={{ background: "var(--text)", color: "var(--bg)" }}
            >
              {submitting ? "Giriş…" : "Devam"}
            </button>
            <p className="mt-4 text-center text-[0.8rem]" style={{ color: "var(--text-faint)" }}>
              Yerel: seed kullanıcı + JWT (RLS)
            </p>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={loginAzure}
              className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-full py-3 text-[0.95rem] font-semibold transition hover:opacity-90"
              style={{ background: "var(--text)", color: "var(--bg)" }}
            >
              <MicrosoftMark /> Microsoft ile giriş
            </button>

            <div className="mt-5 flex items-center gap-3">
              <span className="h-px flex-1" style={{ background: "rgba(var(--border-rgb),0.12)" }} />
              <span className="text-[0.75rem]" style={{ color: "var(--text-faint)" }}>veya</span>
              <span className="h-px flex-1" style={{ background: "rgba(var(--border-rgb),0.12)" }} />
            </div>

            <div className="relative mt-4 overflow-hidden">
              <AnimatePresence mode="wait" initial={false}>
                {step === "email" ? (
                  <motion.div
                    key="email"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.28, ease: EASE }}
                  >
                    <input
                      autoFocus
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && email.includes("@") && setStep("password")}
                      placeholder="iş e-postan"
                      className="w-full rounded-lg px-3.5 py-3 text-[0.95rem] outline-none"
                      style={{
                        background: "var(--surface-2)",
                        border: "1px solid rgba(var(--border-rgb),0.09)",
                        color: "var(--text)",
                      }}
                      disabled={submitting}
                    />
                    <button
                      type="button"
                      onClick={() => setStep("password")}
                      disabled={!email.includes("@")}
                      className="mt-3 w-full rounded-full py-3 text-[0.95rem] font-semibold transition disabled:opacity-40"
                      style={{
                        border: "1px solid rgba(var(--border-rgb),0.18)",
                        color: "var(--text)",
                      }}
                    >
                      Devam
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="password"
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.28, ease: EASE }}
                  >
                    <p className="mb-3 text-[0.85rem]" style={{ color: "var(--text-muted)" }}>
                      <span style={{ color: "var(--text-2)" }}>{email}</span> için şifre gir
                    </p>
                    <input
                      autoFocus
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && void onPasswordLogin()}
                      placeholder="şifre"
                      className="w-full rounded-lg px-3.5 py-3 text-[0.95rem] outline-none"
                      style={{
                        background: "var(--surface-2)",
                        border: "1px solid rgba(var(--border-rgb),0.09)",
                        color: "var(--text)",
                      }}
                      disabled={submitting}
                    />
                    <button
                      type="button"
                      onClick={() => void onPasswordLogin()}
                      disabled={submitting || !password}
                      className="mt-3 w-full rounded-full py-3 text-[0.95rem] font-semibold transition disabled:opacity-40"
                      style={{
                        border: "1px solid rgba(var(--border-rgb),0.18)",
                        color: "var(--text)",
                      }}
                    >
                      {submitting ? "…" : "Giriş yap"}
                    </button>
                    <div className="mt-3 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setStep("email")}
                        className="text-[0.82rem] font-medium"
                        style={{ color: "var(--text-faint)" }}
                      >
                        ← Geri
                      </button>
                      <button
                        type="button"
                        onClick={() => void onForgotPassword()}
                        disabled={submitting}
                        className="text-[0.82rem] font-medium disabled:opacity-40"
                        style={{ color: "var(--text-faint)" }}
                      >
                        Şifremi unuttum
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
    </div>
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
