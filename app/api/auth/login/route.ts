import { NextResponse } from "next/server";
import {
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
 * POST /api/auth/login — e-posta + şifre.
 *
 * ÖNEMLİ: burada ASLA signUp'a düşülmez. Supabase sürümünde /login yanlış
 * şifrede sessizce yeni hesap açabiliyordu; ekip bunu fb2e39d'de düzeltti
 * ("working email+password login and honest email-confirmation flow") ve o
 * davranış burada da korunuyor — yanlış şifre yanlış şifredir.
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
  if (!email.includes("@") || !password) {
    return NextResponse.json({ error: "E-posta veya şifre hatalı." }, { status: 400 });
  }

  const cred = await findCredential(email);

  // Kullanıcı yoksa da parola doğrulaması ÇALIŞTIRILIYOR (hash null → false),
  // ama asıl nokta cevabın aynı olması: "hesap var mı" sorusunun cevabı
  // giriş ekranından sızmasın.
  const ok = cred ? await verifyPassword(password, cred.password_hash) : false;

  if (!cred || !ok) {
    return NextResponse.json({ error: "E-posta veya şifre hatalı." }, { status: 401 });
  }
  if (cred.disabled_at) {
    return NextResponse.json({ error: "Bu hesap devre dışı." }, { status: 403 });
  }

  const { token, expiresAt } = await createSession(email, {
    userAgent: req.headers.get("user-agent"),
    ip: req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? null,
  });

  const res = NextResponse.json({ ok: true, email });
  res.headers.set("Set-Cookie", sessionCookie(token, expiresAt, isSecureRequest(req)));
  return res;
}
