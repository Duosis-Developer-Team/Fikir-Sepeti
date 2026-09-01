import { NextResponse } from "next/server";
import {
  consumePasswordReset,
  createPasswordReset,
  findCredential,
  revokeAllSessions,
  sendEmail,
  setPassword,
} from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST — sıfırlama iste. Hesap olmasa bile 200 döner: bu uç, bir e-postanın
 * kayıtlı olup olmadığını öğrenmenin yolu OLMAMALI.
 */
export async function POST(req: Request) {
  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  const lower = email?.trim().toLowerCase() ?? "";
  if (!lower.includes("@")) {
    return NextResponse.json({ error: "Geçerli bir e-posta gerekli." }, { status: 400 });
  }

  const cred = await findCredential(lower);
  if (cred) {
    const token = await createPasswordReset(lower);
    const origin = new URL(req.url).origin;
    await sendEmail({
      to: lower,
      kind: "reset",
      subject: "Fikir Sepeti — şifre sıfırlama",
      body: `Şifreni sıfırlamak için: ${origin}/login?reset=${token}\n\nBu linki sen istemediysen yok say.`,
    });
  }

  return NextResponse.json({ ok: true });
}

/** PUT — yeni şifreyi yaz. */
export async function PUT(req: Request) {
  const { token, password } = (await req.json().catch(() => ({}))) as {
    token?: string;
    password?: string;
  };
  if (!token || !password || password.length < 6) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const email = await consumePasswordReset(token);
  if (!email) {
    return NextResponse.json(
      { error: "Bu sıfırlama linki geçersiz ya da süresi dolmuş." },
      { status: 400 }
    );
  }

  await setPassword(email, password);
  // Şifre değiştiyse eski oturumlar da düşmeli — sıfırlamanın amacı hesabı
  // geri almaksa, saldırganın açık oturumu ayakta kalmamalı.
  await revokeAllSessions(email);

  return NextResponse.json({ ok: true });
}
