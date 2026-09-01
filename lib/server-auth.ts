import "server-only";

import type { Permission } from "./permissions";
import { dbForIdentity, type Db } from "./server/pgrest";
import { resolveIdentity as resolveIdentityImpl } from "./server/identity";

/**
 * Route handler'ların kimlik + veritabanı girişi.
 *
 * DIŞA AÇIK API BİLEREK AYNI KALDI (`resolveIdentity`, `getDb`,
 * `userHasPermission`, `userHasPermissionAnyTenant`): 32 route handler bu
 * modülü kullanıyor ve hiçbiri değişmedi. Değişen sadece gövde — Supabase
 * istemcisi yerine `pg` üstünde PostgREST uyumlu kurucu (lib/server/pgrest.ts).
 *
 * KALDIRILAN: `supabaseAdmin()` ve service-role kavramı. Eskiden `getDb`
 * SUPABASE_SERVICE_ROLE_KEY varsa RLS'i TAMAMEN atlayan bir istemci
 * döndürüyordu. Artık her sorgu çağıranın kimliğiyle ve RLS altında koşuyor.
 * Bu, üretimin bugünkü davranışıyla da uyumlu: prod'da service role anahtarı
 * hiç ayarlanmamıştı (bkz. docs/sprints/gap-analysis-after-S11.md), yani
 * canlı sistem zaten kullanıcı kimliğiyle çalışıyordu.
 */

export type RequestIdentity = {
  userId: string;
  email: string;
  tenantId: string;
};

export async function resolveIdentity(req: Request): Promise<RequestIdentity | null> {
  const identity = await resolveIdentityImpl(req);
  if (!identity) return null;
  return {
    userId: identity.userId,
    email: identity.email,
    tenantId: identity.tenantId,
  };
}

/**
 * İstek için veritabanı erişimi. Kimlik TEMBEL çözülüyor: route'lar bunu
 * senkron çağırıyor (`const sb = getDb(req)`), oysa kimliği çözmek asenkron.
 * İlk sorguda bir kez çözülüp saklanıyor.
 */
export function getDb(req: Request): Db {
  return dbForIdentity(async () => {
    const identity = await resolveIdentityImpl(req);
    return identity?.email ?? null;
  });
}

function isRequestLike(v: unknown): v is Request {
  return Boolean(v && typeof (v as Request).headers?.get === "function");
}

function resolveDb(reqOrDb?: Request | Db): Db {
  if (!reqOrDb) {
    // Kimliksiz erişim: RLS hiçbir satır döndürmez. Eskiden burası
    // supabaseAdmin() ile RLS'i atlıyordu; artık atlamıyor.
    return dbForIdentity(null);
  }
  if (isRequestLike(reqOrDb)) return getDb(reqOrDb);
  return reqOrDb;
}

/**
 * İzin kontrolü. İmza korundu — çağıranlar hem `(t, u, p, req)` hem
 * `(t, u, p, basketId, req)` şeklinde çağırıyor.
 */
export async function userHasPermission(
  tenantId: string,
  userId: string,
  permission: Permission,
  scopeOrReq?: string | null | Request | Db,
  reqOrDb?: Request | Db
): Promise<boolean> {
  let scopeBasketId: string | null | undefined;
  let dbSource: Request | Db | undefined;
  if (scopeOrReq == null || typeof scopeOrReq === "string") {
    scopeBasketId = scopeOrReq;
    dbSource = reqOrDb;
  } else {
    dbSource = scopeOrReq as Request | Db;
  }

  const sb = resolveDb(dbSource);
  const { data: rows } = await sb
    .from("user_roles")
    .select("role_id, scope_basket_id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);

  const list = (rows ?? []) as { role_id: string; scope_basket_id: string | null }[];
  if (!list.length) return false;

  const roleIds = list
    .filter((r) => {
      const scope = r.scope_basket_id;
      if (scope == null) return true;
      // Sepet-kapsamlı rol (jüri) yalnızca o sepette geçerli.
      return Boolean(scopeBasketId && scope === scopeBasketId);
    })
    .map((r) => r.role_id);

  if (!roleIds.length) return false;

  const { data: perms } = await sb
    .from("role_permissions")
    .select("permission_key")
    .in("role_id", roleIds)
    .eq("permission_key", permission);

  return ((perms ?? []) as unknown[]).length > 0;
}

/** Kullanıcı bu izni HERHANGİ bir tenant'ta taşıyor mu (platform_owner). */
export async function userHasPermissionAnyTenant(
  userId: string,
  permission: Permission,
  reqOrDb?: Request | Db
): Promise<boolean> {
  const sb = resolveDb(reqOrDb);
  const { data: rows } = await sb
    .from("user_roles")
    .select("role_id")
    .eq("user_id", userId)
    .is("scope_basket_id", null);

  const list = (rows ?? []) as { role_id: string }[];
  if (!list.length) return false;

  const { data: perms } = await sb
    .from("role_permissions")
    .select("permission_key")
    .in(
      "role_id",
      list.map((r) => r.role_id)
    )
    .eq("permission_key", permission);

  return ((perms ?? []) as unknown[]).length > 0;
}
