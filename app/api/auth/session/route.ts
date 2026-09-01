import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  identityFromToken,
  isSecureRequest,
  sweepExpired,
  tokenFromRequest,
} from "@/lib/server/auth";
import { query, withIdentity } from "@/lib/server/pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/session — AuthGate'in açılışta sorduğu tek soru.
 *
 * Eskiden istemci bunu üç adımda yapıyordu: supabase.auth.getSession() →
 * rpc('resolve_tenant_for_claims') → rpc('ensure_app_membership'). Üçü de
 * tarayıcıdan veritabanına gidiyordu. Artık tek sunucu turu.
 *
 * Üç ayrı durum döner ve AuthGate bunları ayırt etmek ZORUNDA:
 *   user: null                      → oturum yok           → /login
 *   user.tenantId: null + denied    → oturum var, çalışma alanı yok → /register
 *   user.tenantId dolu              → içeri
 */
export async function GET(req: Request) {
  void sweepExpired();

  const token = tokenFromRequest(req);
  const session = await identityFromToken(token);

  if (!session) {
    // Çerez var ama geçersizse (süresi geçmiş / iptal edilmiş) tarayıcıdan
    // temizle; yoksa her istekte boşuna gönderilmeye devam eder.
    const res = NextResponse.json({ user: null, needsWorkspace: false, tenantDenied: false });
    if (token) res.headers.set("Set-Cookie", clearSessionCookie(isSecureRequest(req)));
    return res;
  }

  // Çalışma alanı çözümlemesi + üyelik garantisi. Her ikisi de SECURITY
  // DEFINER fonksiyon; kimlik henüz yokken çalışabilmeleri gerekiyor.
  const resolved = await query<{ tenant_id: string | null }>(
    `select public.resolve_tenant_for_claims($1, null) as tenant_id`,
    [session.email]
  );
  const tenantId = resolved[0]?.tenant_id ?? null;

  if (tenantId) {
    // Domain eşleşmesiyle ilk kez giren kullanıcıyı app_users'a yazar.
    await query(`select public.ensure_app_membership($1, $2)`, [session.email, tenantId]);
  }

  const displayName =
    session.displayName ??
    (tenantId
      ? await withIdentity(session.email, async (c) => {
          const r = await c.query<{ display_name: string | null }>(
            `select display_name from app_users where lower(email) = $1 limit 1`,
            [session.email]
          );
          return r.rows[0]?.display_name ?? null;
        })
      : null);

  return NextResponse.json({
    user: {
      id: session.email,
      email: session.email,
      name: displayName || session.email.split("@")[0],
      tenantId,
    },
    needsWorkspace: !tenantId,
    tenantDenied: !tenantId,
  });
}
