import { NextResponse } from "next/server";
import { query } from "@/lib/server/pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tenant/peek?email=... — bu e-posta bir çalışma alanına düşüyor mu?
 * /register ekranı, kullanıcıya "şirketine katılacaksın" mı yoksa "kendi
 * alanını aç" mı diyeceğini buradan öğreniyor.
 *
 * OTURUM GEREKTİRMEZ (kayıt öncesi çağrılıyor) ve bu bilinçli olarak SADECE
 * çalışma alanının ADINI dönüyor — üye listesi, kullanıcı sayısı gibi hiçbir
 * şey yok. Yine de bir e-posta domain'inin kayıtlı olup olmadığını sızdırır;
 * bu, kayıt akışının çalışması için gereken asgari bilgi.
 */
export async function GET(req: Request) {
  const email = new URL(req.url).searchParams.get("email")?.trim().toLowerCase() ?? "";
  if (!email.includes("@")) {
    return NextResponse.json({ tenant: null });
  }

  const rows = await query<{ tenant_id: string; tenant_name: string; via: string }>(
    `select * from public.peek_tenant_for_email($1)`,
    [email]
  );
  const row = rows[0];
  return NextResponse.json({
    tenant: row ? { id: row.tenant_id, name: row.tenant_name, via: row.via } : null,
  });
}
