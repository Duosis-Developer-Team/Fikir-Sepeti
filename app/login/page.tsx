"use client";

import { useState } from "react";
import { BrandIcon } from "@/components/BrandIcon";
import { useSession } from "@/components/AuthGate";

export default function LoginPage() {
  const {
    ready,
    user,
    bypass,
    tenantDenied,
    deniedEmail,
    loginError,
    loginAzure,
    devLogin,
    signOut,
    clearLoginError,
  } = useSession();
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!ready || user) {
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
              Domain&apos;iniz tenant listesinde kayıtlı değil. Erişim reddedildi.
            </p>
            <button
              type="button"
              onClick={signOut}
              className="mt-3 w-full rounded-full py-2 text-[0.85rem] font-semibold transition hover:opacity-90"
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
          <button
            type="button"
            onClick={loginAzure}
            className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-full py-3 text-[0.95rem] font-semibold transition hover:opacity-90"
            style={{ background: "var(--text)", color: "var(--bg)" }}
          >
            <MicrosoftMark /> Microsoft ile giriş
          </button>
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
