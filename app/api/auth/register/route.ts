import { NextResponse } from "next/server";
import {
  createCredential,
  createSession,
  findCredential,
  isSecureRequest,
  sessionCookie,
  sweepExpired,
  verifyPassword,
} from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/register — hesap aç.
 *
 * E-posta DOĞRULAMASI KAPALI (karar: pilot, EMAIL_PROVIDER=log_only). Kayıt
 * olan anında giriş yapmış olur. Supabase sürümündeki "needsConfirmation"
 * ekranı bu yüzden artık tetiklenmiyor; SMTP bağlandığında email_verified
 * kolonu ve o akış geri açılır.
 */
export async function POST(req: Request) {
  void sweepExpired();

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  if (!email.includes("@")) {
    return NextResponse.json({ error: "Geçerli bir e-posta gerekli." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Şifre en az 6 karakter olmalı." }, { status: 400 });
  }

  const existing = await findCredential(email);
  if (existing) {
    // Aynı formu tekrar gönderen, zaten hesabı olan kullanıcı: doğru şifreyle
    // sessizce girsin (Supabase sürümündeki davranış), yanlışsa dürüst hata.
    if (existing.password_hash && (await verifyPassword(password, existing.password_hash))) {
      const { token, expiresAt } = await createSession(email);
      const res = NextResponse.json({ ok: true, email, existing: true });
      res.headers.set("Set-Cookie", sessionCookie(token, expiresAt, isSecureRequest(req)));
      return res;
    }
    return NextResponse.json(
      { error: "Bu e-posta ile zaten bir hesap var. Şifreni mi unuttun?" },
      { status: 409 }
    );
  }

  await createCredential({
    email,
    password,
    provider: "password",
    // Doğrulama akışı kapalıyken hesabı "doğrulanmamış" bırakmak, ileride
    // doğrulama açıldığında MEVCUT kullanıcıları kilitler. Bilinçli: kapalıyken
    // doğrulanmış sayılıyor.
    emailVerified: true,
  });

  const { token, expiresAt } = await createSession(email, {
    userAgent: req.headers.get("user-agent"),
  });
  const res = NextResponse.json({ ok: true, email });
  res.headers.set("Set-Cookie", sessionCookie(token, expiresAt, isSecureRequest(req)));
  return res;
}
