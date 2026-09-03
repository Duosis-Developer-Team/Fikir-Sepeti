import { NextResponse } from "next/server";
import { resolveSessionOnly } from "@/lib/server/identity";
import { query } from "@/lib/server/pg";
import { normalizeInviteCode } from "@/lib/register";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/workspace — çalışma alanı oluştur ya da davetle katıl.
 *
 * Eskiden AuthGate bu iki RPC'yi (create_tenant_for_user / join_tenant_by_invite)
 * doğrudan tarayıcıdan çağırıyordu. Fonksiyonlar SECURITY DEFINER ve e-postayı
 * PARAMETRE olarak alıyor — yani tarayıcıdan çağrıldığında herhangi biri
 * başkasının e-postasını geçip onun adına çalışma alanı açabilirdi. Sunucuya
 * taşınınca e-posta artık OTURUMDAN geliyor, istekten değil.
 */
export async function POST(req: Request) {
  const session = await resolveSessionOnly(req);
  if (!session) {
    return NextResponse.json({ error: "Önce hesap oluştur." }, { status: 401 });
  }

  let body: { action?: "create" | "join"; name?: string; domain?: string | null; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    if (body.action === "join") {
      const code = normalizeInviteCode(body.code ?? "");
      if (!code) return NextResponse.json({ error: "Davet kodu gerekli." }, { status: 400 });
      const rows = await query<{ tenant_id: string | null }>(
        `select public.join_tenant_by_invite($1, $2) as tenant_id`,
        [code, session.email]
      );
      const tenantId = rows[0]?.tenant_id ?? null;
      if (!tenantId) return NextResponse.json({ error: "Davet geçersiz." }, { status: 400 });
      return NextResponse.json({ ok: true, tenantId });
    }

    const name = body.name?.trim() ?? "";
    if (name.length < 2) {
      return NextResponse.json({ error: "Çalışma alanı adı gerekli." }, { status: 400 });
    }
    const rows = await query<{ tenant_id: string | null }>(
      `select public.create_tenant_for_user($1, $2, $3) as tenant_id`,
      [name, body.domain?.trim() || null, session.email]
    );
    const tenantId = rows[0]?.tenant_id ?? null;
    if (!tenantId) {
      return NextResponse.json({ error: "Çalışma alanı oluşturulamadı." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, tenantId });
  } catch (err) {
    // Fonksiyonlar anlamlı mesajlarla raise ediyor ("domain already taken",
    // "user already belongs to a tenant"); onları kullanıcıya taşı.
    const message = (err as Error).message.replace(/^error:\s*/i, "");
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
