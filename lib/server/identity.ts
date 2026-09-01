import "server-only";

import { identityFromToken, tokenFromRequest } from "./auth";
import { withIdentity } from "./pg";

/**
 * İstek → kimlik. `lib/server-auth.ts`'deki resolveIdentity'nin Supabase'siz
 * karşılığı; dönen şekil bilerek AYNI (userId/email/tenantId), böylece 32 route
 * handler'ın gövdesi değişmiyor.
 *
 * Zincir: çerezdeki opak oturum jetonu → e-posta → app_users → tenant.
 * Tenant'ı JWT'den değil her zaman veritabanından okuyoruz: bir kullanıcı
 * çalışma alanından çıkarıldığında elindeki çerez onu içeride tutmasın.
 */

export type RequestIdentity = {
  userId: string;
  email: string;
  tenantId: string;
  displayName: string | null;
};

/** Test/CI köprüsü. Prod imajında AUTH_BYPASS ayarlanmaz; ayarlanırsa
 *  uygulama açılışta uyarır (bkz. instrumentation.ts). */
function bypassIdentity(req: Request): { email: string; tenantId: string } | null {
  if (process.env.NEXT_PUBLIC_AUTH_BYPASS !== "1") return null;
  const header = req.headers.get("x-dev-user");
  if (!header) return null;
  try {
    const parsed = JSON.parse(header) as { email?: string; tenantId?: string };
    if (parsed.email && parsed.tenantId) {
      return { email: parsed.email.toLowerCase(), tenantId: parsed.tenantId };
    }
  } catch {
    /* bozuk başlık = kimlik yok */
  }
  return null;
}

export async function resolveIdentity(req: Request): Promise<RequestIdentity | null> {
  const bypass = bypassIdentity(req);
  if (bypass) {
    return {
      userId: bypass.email,
      email: bypass.email,
      tenantId: bypass.tenantId,
      displayName: bypass.email.split("@")[0],
    };
  }

  const session = await identityFromToken(tokenFromRequest(req));
  if (!session) return null;

  // app_users okuması RLS altında: kimlik GUC'a yazılıyor, current_tenant_id()
  // (SECURITY DEFINER) e-postadan tenant'ı çözüyor ve politika eşleşiyor.
  const row = await withIdentity(session.email, async (client) => {
    const res = await client.query<{ tenant_id: string; user_id: string; email: string }>(
      `select tenant_id, user_id, email from app_users where lower(email) = $1 limit 1`,
      [session.email]
    );
    return res.rows[0] ?? null;
  });

  if (!row) {
    // Oturum var ama henüz bir çalışma alanına bağlı değil (SG2 onboarding).
    // Çağıranlar bunu 401 olarak görüyor; /api/auth/session ayrı olarak
    // "oturum var, tenant yok" durumunu dönebiliyor.
    return null;
  }

  return {
    userId: row.user_id,
    email: row.email.toLowerCase(),
    tenantId: row.tenant_id,
    displayName: session.displayName,
  };
}

/** Oturum var mı — tenant'a bağlı olmasa bile. /register onboarding için. */
export async function resolveSessionOnly(
  req: Request
): Promise<{ email: string; displayName: string | null } | null> {
  const bypass = bypassIdentity(req);
  if (bypass) return { email: bypass.email, displayName: bypass.email.split("@")[0] };
  return identityFromToken(tokenFromRequest(req));
}
