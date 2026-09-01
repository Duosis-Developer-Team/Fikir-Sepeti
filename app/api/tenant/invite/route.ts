import { NextResponse } from "next/server";
import { resolveIdentity, userHasPermission } from "@/lib/server-auth";
import { withIdentity } from "@/lib/server/pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/tenant/invite — davet kodu üret.
 *
 * `create_tenant_invite` SECURITY DEFINER ve tenant'ı parametre alıyor;
 * eskiden tarayıcıdan doğrudan çağrılıyordu. Fonksiyonun kendi içinde de
 * yetki kontrolü var ama kimliği JWT'den okuyordu — kimlik katmanı değişince
 * o yol kapandı. Burada tenant OTURUMDAN geliyor ve izin açıkça kontrol
 * ediliyor; fonksiyon içindeki kontrol ikinci savunma hattı olarak duruyor.
 */
export async function POST(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const can = await userHasPermission(
    identity.tenantId,
    identity.userId,
    "tenant.manage_roles",
    req
  );
  if (!can) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    const code = await withIdentity(identity.email, async (c) => {
      const r = await c.query<{ code: string }>(
        `select public.create_tenant_invite($1) as code`,
        [identity.tenantId]
      );
      return r.rows[0]?.code ?? null;
    });
    if (!code) return NextResponse.json({ error: "Kod üretilemedi." }, { status: 500 });
    return NextResponse.json({ code });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
