"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { BrandIcon } from "@/components/BrandIcon";
import { apiFetch } from "@/lib/api-headers";
import { DEV_AUTH_PASSWORD } from "@/lib/dev-auth";
import { isPublicPath } from "@/lib/public-paths";

/**
 * Oturum kapısı.
 *
 * Supabase Auth (GoTrue) kaldırıldı. Oturum artık httpOnly ÇEREZDE ve tüm
 * kimlik işleri /api/auth/* üzerinden — JavaScript'in jetona erişimi yok.
 *
 * DIŞA AÇIK SÖZLEŞME (Ctx) BİLEREK AYNI: login/register sayfaları ve
 * useNameContext kullanan ~15 bileşen değişmedi.
 */

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
  devLogin: (draft: string) => Promise<void>;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  /** URL'de tek kullanımlık sıfırlama jetonu var — /login "yeni şifre" formunu gösterir. */
  passwordRecovery: boolean;
  /** Sıfırlama jetonuyla yeni şifreyi yazar. */
  updatePassword: (password: string) => Promise<void>;
  registerWithPassword: (email: string, password: string) => Promise<void>;
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
  passwordRecovery: false,
  updatePassword: async () => {},
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

/** Geriye uyum: eski `useNameContext().name` = kullanıcı kimliği (iş e-postası). */
export function useNameContext() {
  const { user } = useSession();
  return { name: user?.email ?? "", setName: () => {}, tenantId: user?.tenantId ?? null };
}

/** Dev yolu: YALNIZCA localhost + NEXT_PUBLIC_AUTH_BYPASS=1. Prod'da asla. */
export function isDevBypass(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NEXT_PUBLIC_AUTH_BYPASS !== "1") return false;
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1";
}

type SessionResponse = {
  user: SessionUser | null;
  needsWorkspace: boolean;
  tenantDenied: boolean;
};

const LOGIN_PATH = "/login";
const REGISTER_PATH = "/register";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const bypass = typeof window !== "undefined" && isDevBypass();
  const [tenantDenied, setTenantDenied] = useState(false);
  const [deniedEmail, setDeniedEmail] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  /**
   * Şifre sıfırlama jetonu — e-postadaki link `/login?reset=<token>` şeklinde.
   *
   * SUPABASE'DEN FARKI ÖNEMLİ: GoTrue'nun kurtarma linki kullanıcıyı gerçekten
   * OTURUM AÇTIRIYORDU (PASSWORD_RECOVERY olayı); yani linki ele geçiren biri
   * hesabın içinde gezinebiliyordu. Burada link yalnızca tek kullanımlık bir
   * jeton taşıyor: sahibi olan kişi SADECE yeni şifre belirleyebiliyor,
   * uygulamaya giremiyor. Sunucu şifre değişince tüm eski oturumları da
   * iptal ediyor (bkz. app/api/auth/password-reset PUT).
   */
  const [resetToken, setResetToken] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  /** Sunucudaki oturumun tek doğru kaynağı: /api/auth/session. */
  const syncSession = useCallback(async () => {
    const res = await apiFetch<SessionResponse>("/api/auth/session");
    const data = res.data;
    if (!res.ok || !data?.user) {
      setUser(null);
      setTenantDenied(false);
      setDeniedEmail(null);
      return null;
    }
    setUser(data.user);
    setTenantDenied(data.tenantDenied);
    setDeniedEmail(data.tenantDenied ? data.user.email : null);
    return data.user;
  }, []);

  useEffect(() => {
    let settled = false;
    const markReady = () => {
      if (settled) return;
      settled = true;
      setReady(true);
    };

    // Emniyet ağı: asılı kalan bir istek (soğuk başlayan DB, ölü bağlantı)
    // uygulamayı sonsuza kadar yükleme iskeletinde bırakmamalı.
    const timeout = setTimeout(markReady, 8000);

    void syncSession()
      .catch((e) => console.error("ilk oturum kontrolü başarısız", e))
      .finally(() => {
        clearTimeout(timeout);
        markReady();
      });

    return () => clearTimeout(timeout);
  }, [syncSession]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = new URLSearchParams(window.location.search).get("reset");
    if (token) setResetToken(token);
  }, [pathname]);

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
    // Sıfırlama akışındayken uygulamaya atma: kullanıcı buraya yeni şifre
    // belirlemeye geldi. (Supabase sürümünde tam olarak bu olmuştu — kurtarma
    // linki oturum açtırdığı için AuthGate hemen "/"'a yönlendiriyor ve
    // kullanıcı ESKİ şifresiyle içeride kalıyordu.)
    if (resetToken) return;
    if (user?.tenantId && (pathname === LOGIN_PATH || pathname === REGISTER_PATH)) {
      router.replace("/");
    }
  }, [ready, user, needsWorkspace, pathname, router, resetToken]);

  const loginAzure = () => {
    setLoginError(null);
    // Tam sayfa yönlendirme: OAuth akışı tarayıcıyı Microsoft'a götürüp geri
    // getiriyor, fetch ile yapılamaz.
    const back = encodeURIComponent(window.location.pathname);
    window.location.href = `/api/auth/azure/start?redirect_to=${back}`;
  };

  const refreshBinding = async () => {
    await syncSession();
  };

  /** /login — ASLA kayıt akışına düşmez; yanlış şifre yanlış şifredir. */
  const loginWithPassword = async (email: string, password: string) => {
    setLoginError(null);
    setTenantDenied(false);
    setDeniedEmail(null);
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });
    if (!res.ok) {
      const message = res.error ?? "E-posta veya şifre hatalı.";
      setLoginError(message);
      throw new Error(message);
    }
    await syncSession();
  };

  const requestPasswordReset = async (email: string) => {
    await apiFetch("/api/auth/password-reset", {
      method: "POST",
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    });
  };

  const updatePassword = async (password: string) => {
    setLoginError(null);
    if (!resetToken) {
      const message = "Sıfırlama linki geçersiz ya da süresi dolmuş.";
      setLoginError(message);
      throw new Error(message);
    }
    const res = await apiFetch("/api/auth/password-reset", {
      method: "PUT",
      body: JSON.stringify({ token: resetToken, password }),
    });
    if (!res.ok) {
      const message = res.error ?? "Şifre güncellenemedi.";
      setLoginError(message);
      throw new Error(message);
    }
    // Jeton tek kullanımlık ve tüketildi; URL'den de temizleniyor ki sayfa
    // yenilendiğinde form yeniden açılmasın.
    setResetToken(null);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", LOGIN_PATH);
    }
  };

  const registerWithPassword = async (email: string, password: string) => {
    setLoginError(null);
    setTenantDenied(false);
    setDeniedEmail(null);
    const res = await apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
    });
    if (!res.ok) {
      const message = res.error ?? "Kayıt başarısız";
      setLoginError(message);
      throw new Error(message);
    }
    await syncSession();
  };

  const createWorkspace = async (name: string, domain?: string | null) => {
    setLoginError(null);
    const res = await apiFetch("/api/auth/workspace", {
      method: "POST",
      body: JSON.stringify({ action: "create", name, domain: domain ?? null }),
    });
    if (!res.ok) {
      const message = res.error ?? "Çalışma alanı oluşturulamadı";
      setLoginError(message);
      throw new Error(message);
    }
    await syncSession();
  };

  const joinWithInvite = async (code: string) => {
    setLoginError(null);
    const res = await apiFetch("/api/auth/workspace", {
      method: "POST",
      body: JSON.stringify({ action: "join", code }),
    });
    if (!res.ok) {
      const message = res.error ?? "Davet geçersiz";
      setLoginError(message);
      throw new Error(message);
    }
    await syncSession();
  };

  /**
   * CI / yerel geliştirme girişi. Seed kullanıcılar sabit bir parolayla
   * açılıyor; hesap yoksa kayıt edilip girilir. Prod'da bu yol da normal
   * giriş uçlarını kullanıyor — ayrı bir arka kapı YOK.
   */
  const devLogin = async (draft: string) => {
    const clean = draft.trim();
    if (clean.length < 2) return;
    const email = clean.includes("@") ? clean.toLowerCase() : `${clean.toLowerCase()}@duosis.dev`;
    setLoginError(null);
    setTenantDenied(false);
    setDeniedEmail(null);

    const login = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password: DEV_AUTH_PASSWORD }),
    });

    if (!login.ok) {
      const signup = await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password: DEV_AUTH_PASSWORD }),
      });
      if (!signup.ok) {
        setLoginError(signup.error ?? "Giriş başarısız — seed kullanıcı mı?");
        return;
      }
    }

    await syncSession();
  };

  const signOut = () => {
    void apiFetch("/api/auth/logout", { method: "POST" }).then(() => {
      setUser(null);
      setTenantDenied(false);
      setDeniedEmail(null);
      setLoginError(null);
    });
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
    passwordRecovery: resetToken !== null,
    updatePassword,
    registerWithPassword,
    // E-posta doğrulaması bu kurulumda KAPALI (EMAIL_PROVIDER=log_only):
    // kayıt olan anında giriyor. Alanlar sözleşmeyi bozmamak için duruyor;
    // SMTP bağlanınca /api/auth/register bunları yeniden doldurabilir.
    needsConfirmation: false,
    confirmationEmail: null,
    resendConfirmation: async () => {},
    clearNeedsConfirmation: () => {},
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

/** Oturum kontrolü sürerken gösterilir — app/loading.tsx ile aynı görsel dil. */
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
