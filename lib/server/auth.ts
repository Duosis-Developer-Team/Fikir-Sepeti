import "server-only";

import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { query, queryOne } from "./pg";

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number }
) => Promise<Buffer>;

/**
 * Kimlik katmanı — Supabase Auth (GoTrue) yerine.
 *
 * Tasarım kararları:
 * - Oturum jetonu OPAK ve rastgele; JWT değil. Veritabanında sadece sha256'sı
 *   duruyor, böylece bir DB dökümü oturum çalmaya yetmiyor. Ayrıca "çıkış yap"
 *   ve "tüm oturumları kapat" gerçekten çalışıyor — stateless JWT'de imkânsız.
 * - Parola scrypt ile; bcrypt/argon2 yerine node:crypto'da yerleşik olduğu için
 *   native derleme gerektirmiyor (alpine imajında derleyici yok).
 */

const SESSION_COOKIE = "fs_session";
const SESSION_TTL_DAYS = 30;
const RESET_TTL_MINUTES = 60;
const OAUTH_STATE_TTL_MINUTES = 15;

// scrypt parametreleri. N=2^15 tek hash'te ~60-100ms — giriş uç noktası için
// kabul edilebilir, kaba kuvvet için pahalı.
const SCRYPT = { N: 32768, r: 8, p: 1 } as const;
const KEYLEN = 32;

export type SessionIdentity = {
  email: string;
  displayName: string | null;
};

// ── Parola ──────────────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEYLEN, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password, salt, expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  // Uzunluklar farklıysa timingSafeEqual fırlatır; önce kontrol et.
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

// ── Oturum ──────────────────────────────────────────────────────────────────

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function sessionCookieName(): string {
  return SESSION_COOKIE;
}

export async function createSession(
  email: string,
  meta: { userAgent?: string | null; ip?: string | null } = {}
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86400_000);
  await query(
    `insert into auth_sessions (token_hash, email, expires_at, user_agent, ip)
     values ($1, $2, $3, $4, $5)`,
    [sha256(token), email.toLowerCase(), expiresAt, meta.userAgent ?? null, meta.ip ?? null]
  );
  await query(`update auth_credentials set last_login_at = now() where email = $1`, [
    email.toLowerCase(),
  ]);
  return { token, expiresAt };
}

/** Çerezdeki jetondan kimliği çözer. Geçersiz/süresi geçmiş/iptal → null. */
export async function identityFromToken(token: string | null | undefined): Promise<SessionIdentity | null> {
  if (!token) return null;
  const row = await queryOne<{ email: string; display_name: string | null }>(
    `select s.email, c.display_name
       from auth_sessions s
       join auth_credentials c on c.email = s.email
      where s.token_hash = $1
        and s.revoked_at is null
        and s.expires_at > now()
        and c.disabled_at is null`,
    [sha256(token)]
  );
  if (!row) return null;
  // last_seen: "bu oturum hâlâ kullanılıyor mu" sorusunun cevabı. Her istekte
  // yazmak gereksiz yük olurdu; sadece 1 saatten eskiyse güncelleniyor.
  await query(
    `update auth_sessions set last_seen_at = now()
      where token_hash = $1 and last_seen_at < now() - interval '1 hour'`,
    [sha256(token)]
  );
  return { email: row.email, displayName: row.display_name };
}

export async function revokeSession(token: string | null | undefined): Promise<void> {
  if (!token) return;
  await query(`update auth_sessions set revoked_at = now() where token_hash = $1`, [
    sha256(token),
  ]);
}

export async function revokeAllSessions(email: string): Promise<void> {
  await query(
    `update auth_sessions set revoked_at = now()
      where email = $1 and revoked_at is null`,
    [email.toLowerCase()]
  );
}

/** Çerez başlığı. secure yalnızca https'te — NodePort üzerinden http erişim
 *  ilk aşamada kullanılıyor ve secure çerez orada tarayıcıya hiç ulaşmaz. */
export function sessionCookie(token: string, expiresAt: Date, secure: boolean): string {
  const attrs = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${expiresAt.toUTCString()}`,
  ];
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}

export function clearSessionCookie(secure: boolean): string {
  const attrs = [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];
  if (secure) attrs.push("Secure");
  return attrs.join("; ");
}

export function tokenFromRequest(req: Request): string | null {
  const cookie = req.headers.get("cookie");
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === SESSION_COOKIE) return v.join("=") || null;
  }
  return null;
}

export function isSecureRequest(req: Request): boolean {
  // Ingress/Cloudflare arkasında TLS sonlandırılıyor; orijinal şema bu başlıkta.
  const proto = req.headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  return new URL(req.url).protocol === "https:";
}

// ── Hesap ───────────────────────────────────────────────────────────────────

export type CredentialRow = {
  email: string;
  password_hash: string | null;
  email_verified: boolean;
  provider: string;
  display_name: string | null;
  disabled_at: Date | null;
};

export async function findCredential(email: string): Promise<CredentialRow | null> {
  return queryOne<CredentialRow>(
    `select email, password_hash, email_verified, provider, display_name, disabled_at
       from auth_credentials where email = $1`,
    [email.toLowerCase()]
  );
}

export async function createCredential(input: {
  email: string;
  password?: string | null;
  provider?: "password" | "azure";
  azureObjectId?: string | null;
  displayName?: string | null;
  emailVerified?: boolean;
}): Promise<CredentialRow> {
  const email = input.email.toLowerCase();
  const hash = input.password ? await hashPassword(input.password) : null;
  const rows = await query<CredentialRow>(
    `insert into auth_credentials
       (email, password_hash, provider, azure_object_id, display_name, email_verified)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (email) do update set
       -- Azure ile ilk kez giren, daha önce şifreyle açılmış bir hesabın
       -- şifresini EZMEZ; sadece eksik alanları doldurur.
       password_hash   = coalesce(auth_credentials.password_hash, excluded.password_hash),
       azure_object_id = coalesce(excluded.azure_object_id, auth_credentials.azure_object_id),
       display_name    = coalesce(auth_credentials.display_name, excluded.display_name),
       email_verified  = auth_credentials.email_verified or excluded.email_verified,
       updated_at      = now()
     returning email, password_hash, email_verified, provider, display_name, disabled_at`,
    [
      email,
      hash,
      input.provider ?? "password",
      input.azureObjectId ?? null,
      input.displayName ?? email.split("@")[0],
      input.emailVerified ?? false,
    ]
  );
  return rows[0];
}

export async function setPassword(email: string, password: string): Promise<void> {
  const hash = await hashPassword(password);
  await query(
    `update auth_credentials set password_hash = $2, updated_at = now() where email = $1`,
    [email.toLowerCase(), hash]
  );
}

// ── Şifre sıfırlama ─────────────────────────────────────────────────────────

export async function createPasswordReset(email: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await query(
    `insert into auth_password_resets (token_hash, email, expires_at)
     values ($1, $2, now() + ($3 || ' minutes')::interval)`,
    [sha256(token), email.toLowerCase(), String(RESET_TTL_MINUTES)]
  );
  return token;
}

export async function consumePasswordReset(token: string): Promise<string | null> {
  const rows = await query<{ email: string }>(
    `update auth_password_resets set used_at = now()
      where token_hash = $1 and used_at is null and expires_at > now()
      returning email`,
    [sha256(token)]
  );
  return rows[0]?.email ?? null;
}

// ── E-posta (log_only) ──────────────────────────────────────────────────────

/**
 * LOGISLOT'taki `LOGISLOT_EMAIL_PROVIDER=log_only` deseninin aynısı: SMTP
 * yokken e-posta GÖNDERİLMEZ, email_outbox'a yazılır. Böylece "link gitti mi"
 * sorusunun cevabı bir SELECT uzaklıkta olur ve SMTP geldiğinde tek config
 * değişikliğiyle gerçek gönderime geçilir.
 */
export async function sendEmail(input: {
  to: string;
  subject: string;
  body: string;
  kind: string;
}): Promise<void> {
  const provider = process.env.EMAIL_PROVIDER ?? "log_only";
  if (provider === "log_only") {
    await query(
      `insert into email_outbox (to_email, subject, body, kind, status)
       values ($1, $2, $3, $4, 'logged')`,
      [input.to.toLowerCase(), input.subject, input.body, input.kind]
    );
    return;
  }
  // SMTP açıldığında burası doldurulur; şimdilik yanlışlıkla "gönderildi"
  // sanılmasın diye kayıt failed olarak düşüyor.
  await query(
    `insert into email_outbox (to_email, subject, body, kind, status, error)
     values ($1, $2, $3, $4, 'failed', $5)`,
    [
      input.to.toLowerCase(),
      input.subject,
      input.body,
      input.kind,
      `EMAIL_PROVIDER=${provider} isteniyor ama SMTP taşıyıcısı henüz bağlanmadı`,
    ]
  );
}

// ── Bakım ───────────────────────────────────────────────────────────────────

let lastSweep = 0;

/** Süresi geçmiş oturum/jeton temizliği. Cron yok: giriş uçları saatte bir
 *  tetikliyor. Hata yutuluyor — temizlik bir isteği düşürmemeli. */
export async function sweepExpired(): Promise<void> {
  const now = Date.now();
  if (now - lastSweep < 3600_000) return;
  lastSweep = now;
  try {
    await query("select public.auth_sweep_expired()");
  } catch (err) {
    console.warn("auth_sweep_expired başarısız:", (err as Error).message);
  }
}

export const AUTH_TTL = {
  sessionDays: SESSION_TTL_DAYS,
  resetMinutes: RESET_TTL_MINUTES,
  oauthStateMinutes: OAUTH_STATE_TTL_MINUTES,
};
