import { NextResponse } from "next/server";
import {
  createCredential,
  createSession,
  isSecureRequest,
  sessionCookie,
} from "@/lib/server/auth";
import { completeAzureLogin, consumeRedirectTarget } from "@/lib/server/azure";
import { query } from "@/lib/server/pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/azure/callback — Microsoft'tan dönüş.
 *
 * Hata durumunda JSON değil, /login'e anlaşılır bir mesajla YÖNLENDİRİLİR:
 * buraya tarayıcı geliyor, fetch değil; kullanıcı ham JSON görmemeli.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);

  // Yönlendirmeler GÖRECELİ veriliyor. Mutlak URL kurmak origin gerektiriyor
  // ve Next standalone'da `req.url` pod'un bind adresini taşıyabiliyor
  // (`http://0.0.0.0:3000/...`) — 2026-09-01'de Microsoft girişi başarılı
  // olduğu halde kullanıcı `https://0.0.0.0:3000/login`'e atıldı ve "bu siteye
  // ulaşılamıyor" gördü. Göreceli Location'ı tarayıcı kendi adres çubuğuna
  // göre çözüyor, yani hangi host'tan gelindiyse oraya dönülüyor; hedefin
  // uygulama içi olduğunu consumeRedirectTarget garanti ediyor.
  const goto = (path: string) =>
    new NextResponse(null, { status: 302, headers: { Location: path } });
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  const fail = (message: string) => goto(`/login?error=${encodeURIComponent(message)}`);

  if (oauthError) return fail(oauthError);
  if (!code || !state) return fail("Microsoft yanıtı eksik geldi.");

  let identity;
  try {
    identity = await completeAzureLogin(req, code, state);
  } catch (err) {
    console.error("azure/callback:", (err as Error).message);
    return fail((err as Error).message);
  }

  // Azure ile ilk kez gelen kullanıcı için şifresiz bir kimlik kaydı açılır.
  // Aynı e-posta daha önce şifreyle açılmışsa createCredential şifreyi EZMEZ;
  // iki giriş yolu aynı hesaba bağlanır.
  await createCredential({
    email: identity.email,
    provider: "azure",
    azureObjectId: identity.objectId,
    displayName: identity.displayName,
    emailVerified: true,
  });

  // Tenant çözümlemesi Azure tid'ini de kullanabiliyor — şirket domain'i
  // tenant_domains'te kayıtlı olmasa bile azure_tenant_id eşleşmesi yeter.
  const resolved = await query<{ tenant_id: string | null }>(
    `select public.resolve_tenant_for_claims($1, $2) as tenant_id`,
    [identity.email, identity.azureTenantId]
  );
  const tenantId = resolved[0]?.tenant_id ?? null;
  if (tenantId) {
    await query(`select public.ensure_app_membership($1, $2)`, [identity.email, tenantId]);
  }

  const { token, expiresAt } = await createSession(identity.email, {
    userAgent: req.headers.get("user-agent"),
  });

  const target = await consumeRedirectTarget(state);
  // Tenant yoksa kullanıcı çalışma alanı kurma akışına düşsün.
  const res = goto(tenantId ? target : "/register");
  res.headers.set("Set-Cookie", sessionCookie(token, expiresAt, isSecureRequest(req)));
  return res;
}
