import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { query, queryOne } from "./pg";
import { AUTH_TTL } from "./auth";
import { publicOrigin } from "../request-origin";

/**
 * Azure Entra ID (v2.0) — Authorization Code + PKCE.
 *
 * Supabase'de bu akışı GoTrue yapıyordu (`signInWithOAuth({provider:'azure'})`).
 * Burada kendimiz yapıyoruz; uygulamanın Azure'dan ihtiyacı olan tek şey
 * kullanıcının İŞ E-POSTASI ve şirketin TENANT ID'si (tid) — çünkü
 * `resolve_tenant_for_claims(email, azure_tid)` çalışma alanını bunlardan
 * çözüyor ve o mantık olduğu gibi duruyor.
 *
 * PKCE gizli anahtarlı (confidential) istemcide zorunlu değil ama ekleniyor:
 * yetkilendirme kodu yönlendirme URL'inden sızsa bile code_verifier olmadan
 * kullanılamaz.
 */

type AzureConfig = {
  tenant: string;
  clientId: string;
  clientSecret: string;
};

export function azureConfigured(): boolean {
  return Boolean(process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_SECRET);
}

function config(): AzureConfig {
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("AZURE_CLIENT_ID / AZURE_CLIENT_SECRET tanımlı değil");
  }
  return {
    // 'organizations' = herhangi bir iş/okul hesabı, kişisel Microsoft hesabı
    // hariç. Ürün çok-kiracılı olduğu için varsayılan bu; tek bir şirkete
    // kilitlemek istenirse AZURE_TENANT_ID'ye o tenant'ın GUID'i yazılır.
    tenant: process.env.AZURE_TENANT_ID || "organizations",
    clientId,
    clientSecret,
  };
}

function authority(tenant: string): string {
  return `https://login.microsoftonline.com/${encodeURIComponent(tenant)}`;
}

// JWKS uzak uçtan çekilir ve jose tarafından önbelleklenir (anahtar rotasyonunu
// kendisi takip eder). Modül seviyesinde tutuluyor ki her girişte yeniden
// kurulmasın.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function keyStore(tenant: string) {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${authority(tenant)}/discovery/v2.0/keys`));
  }
  return jwks;
}

export function redirectUri(req: Request): string {
  // Açıkça verilmişse o kullanılır (ingress/Cloudflare arkasında origin
  // güvenilmez olabilir); yoksa isteğin kendi origin'i.
  const explicit = process.env.AZURE_REDIRECT_URI;
  if (explicit) return explicit;
  return `${publicOrigin(req)}/api/auth/azure/callback`;
}

/** Yetkilendirme URL'i üretir; state + code_verifier veritabanına yazılır. */
export async function beginAzureLogin(req: Request, redirectTo?: string | null): Promise<string> {
  const cfg = config();
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  await query(
    `insert into auth_oauth_states (state, code_verifier, redirect_to, expires_at)
     values ($1, $2, $3, now() + ($4 || ' minutes')::interval)`,
    [state, verifier, redirectTo ?? null, String(AUTH_TTL.oauthStateMinutes)]
  );

  const params = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: "code",
    redirect_uri: redirectUri(req),
    response_mode: "query",
    // email claim'i her zaman gelmiyor; profile ile birlikte
    // preferred_username'e düşebiliyoruz (bkz. emailFromClaims).
    scope: "openid profile email offline_access",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  return `${authority(cfg.tenant)}/oauth2/v2.0/authorize?${params.toString()}`;
}

export type AzureIdentity = {
  email: string;
  azureTenantId: string | null;
  objectId: string | null;
  displayName: string | null;
};

/**
 * Claim'lerden iş e-postasını seçer. Azure her zaman `email` claim'i
 * göndermiyor (uygulama kaydında opsiyonel talep); o yüzden sırayla
 * email → preferred_username → upn deneniyor. GoTrue'daki
 * emailFromAuthUser'ın bu kurulumdaki karşılığı.
 */
export function emailFromClaims(claims: JWTPayload): string | null {
  const candidates = [
    claims.email,
    claims.preferred_username,
    (claims as { upn?: unknown }).upn,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.includes("@")) return c.trim().toLowerCase();
  }
  return null;
}

/**
 * Callback: state'i tüket, kodu jeton ile takas et, id_token'ı DOĞRULA.
 *
 * İmza doğrulaması Microsoft'un JWKS'iyle yapılıyor. Jeton bize TLS üzerinden
 * doğrudan token ucundan geldiği için teknik olarak zorunlu değil; yine de
 * yapılıyor — çünkü "kaynağı güvenilir" varsayımı, akışta ileride bir aracı
 * belirdiğinde sessizce yanlışa dönen türden bir varsayım.
 */
export async function completeAzureLogin(
  req: Request,
  code: string,
  state: string
): Promise<AzureIdentity> {
  const cfg = config();

  const stateRow = await queryOne<{ code_verifier: string; redirect_to: string | null }>(
    `update auth_oauth_states set consumed_at = now()
      where state = $1 and consumed_at is null and expires_at > now()
      returning code_verifier, redirect_to`,
    [state]
  );
  if (!stateRow) {
    // Tek kullanımlık: tekrar oynatma (replay) denemesi burada durur.
    throw new Error("Geçersiz veya süresi geçmiş oturum açma isteği (state)");
  }

  const body = new URLSearchParams({
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(req),
    code_verifier: stateRow.code_verifier,
    scope: "openid profile email offline_access",
  });

  const res = await fetch(`${authority(cfg.tenant)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    // Microsoft'un hata gövdesi teşhis için kritik (yanlış redirect_uri,
    // süresi geçmiş secret vb.) ama kullanıcıya gösterilmiyor.
    console.error("Azure token takası başarısız:", res.status, detail.slice(0, 500));
    throw new Error("Microsoft ile giriş tamamlanamadı");
  }

  const tokens = (await res.json()) as { id_token?: string };
  if (!tokens.id_token) throw new Error("Microsoft yanıtında id_token yok");

  const { payload } = await jwtVerify(tokens.id_token, keyStore(cfg.tenant), {
    audience: cfg.clientId,
    // Çok-kiracılıda issuer her şirket için farklı (.../<tid>/v2.0), o yüzden
    // sabit bir issuer verilemiyor; kalıp olarak doğrulanıyor.
    issuer: undefined,
  });

  const iss = String(payload.iss ?? "");
  if (!/^https:\/\/login\.microsoftonline\.com\/[0-9a-f-]{36}\/v2\.0$/i.test(iss)) {
    throw new Error(`Beklenmeyen issuer: ${iss}`);
  }

  const email = emailFromClaims(payload);
  if (!email) {
    throw new Error(
      "Microsoft hesabında e-posta bulunamadı — uygulama kaydında 'email' claim'i isteniyor mu?"
    );
  }

  return {
    email,
    azureTenantId: typeof payload.tid === "string" ? payload.tid : null,
    objectId: typeof payload.oid === "string" ? payload.oid : null,
    displayName: typeof payload.name === "string" ? payload.name : null,
  };
}

/** Callback sonrası kullanıcının döneceği uygulama içi yol. */
export async function consumeRedirectTarget(state: string): Promise<string> {
  const row = await queryOne<{ redirect_to: string | null }>(
    `select redirect_to from auth_oauth_states where state = $1`,
    [state]
  );
  const target = row?.redirect_to ?? "/";
  // Açık yönlendirme (open redirect) koruması: yalnızca uygulama içi yollar.
  return target.startsWith("/") && !target.startsWith("//") ? target : "/";
}
