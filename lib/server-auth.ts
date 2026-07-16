import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { Permission } from "./permissions";

let _admin: SupabaseClient | null = null;

function supabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL required");
  return url;
}

function anonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY required");
  return key;
}

/** Service-role client (CI / local bypass). Throws if key missing. */
export function supabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY required for server operations");
  }
  _admin = createClient(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

/**
 * DB client for an API request.
 * Prefers service role when set; otherwise uses the caller's Bearer JWT (RLS).
 */
export function getDb(req: Request): SupabaseClient {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return supabaseAdmin();
  }
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return createClient(supabaseUrl(), anonKey(), {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY or Authorization Bearer required for database access"
  );
}

export type RequestIdentity = {
  userId: string;
  email: string;
  tenantId: string;
};

/** Prefer primary email; fall back to identity providers (Azure). */
export function emailFromAuthUser(user: User): string | null {
  const primary = (user.email ?? "").trim().toLowerCase();
  if (primary) return primary;
  for (const id of user.identities ?? []) {
    const data = id.identity_data as Record<string, unknown> | undefined;
    const e = String(data?.email ?? data?.preferred_username ?? "")
      .trim()
      .toLowerCase();
    if (e.includes("@")) return e;
  }
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const me = String(meta?.email ?? "").trim().toLowerCase();
  return me.includes("@") ? me : null;
}

async function lookupAppUser(
  sb: SupabaseClient,
  email: string
): Promise<RequestIdentity | null> {
  const { data: appUser } = await sb
    .from("app_users")
    .select("tenant_id, user_id, email")
    .ilike("email", email)
    .maybeSingle();
  if (!appUser) return null;
  return {
    userId: appUser.user_id as string,
    email: String(appUser.email ?? email).toLowerCase(),
    tenantId: appUser.tenant_id as string,
  };
}

export async function resolveIdentity(req: Request): Promise<RequestIdentity | null> {
  // Prefer real session JWT (production + bypass-with-session)
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    const verify = createClient(supabaseUrl(), anonKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await verify.auth.getUser(token);
    if (error || !data.user) return null;

    const email = emailFromAuthUser(data.user);
    if (!email) return null;

    try {
      return await lookupAppUser(getDb(req), email);
    } catch {
      return null;
    }
  }

  const bypass = process.env.NEXT_PUBLIC_AUTH_BYPASS === "1";
  const devHeader = req.headers.get("x-dev-user");
  if (bypass && devHeader) {
    try {
      const u = JSON.parse(devHeader) as {
        email?: string;
        tenantId?: string;
      };
      if (u.email && u.tenantId) {
        const email = u.email.toLowerCase();
        return { userId: email, email, tenantId: u.tenantId };
      }
    } catch {
      /* ignore */
    }
  }

  return null;
}

function isRequestLike(v: unknown): v is Request {
  return Boolean(v && typeof (v as Request).headers?.get === "function");
}

function resolveDb(reqOrDb?: Request | SupabaseClient): SupabaseClient {
  if (!reqOrDb) return supabaseAdmin();
  if (isRequestLike(reqOrDb)) return getDb(reqOrDb);
  return reqOrDb;
}

/**
 * scopeBasketId may be omitted; callers often pass `req` as the 4th argument.
 * Overloads: (tenant, user, perm, req) | (tenant, user, perm, basketId, req)
 */
export async function userHasPermission(
  tenantId: string,
  userId: string,
  permission: Permission,
  scopeOrReq?: string | null | Request | SupabaseClient,
  reqOrDb?: Request | SupabaseClient
): Promise<boolean> {
  let scopeBasketId: string | null | undefined;
  let dbSource: Request | SupabaseClient | undefined;
  if (scopeOrReq == null || typeof scopeOrReq === "string") {
    scopeBasketId = scopeOrReq;
    dbSource = reqOrDb;
  } else {
    dbSource = scopeOrReq;
  }
  const sb = resolveDb(dbSource);
  const { data: rows } = await sb
    .from("user_roles")
    .select("role_id, scope_basket_id")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);

  if (!rows?.length) return false;

  const roleIds = rows
    .filter((r) => {
      const scope = r.scope_basket_id as string | null;
      if (scope == null) return true;
      return Boolean(scopeBasketId && scope === scopeBasketId);
    })
    .map((r) => r.role_id as string);

  if (!roleIds.length) return false;

  const { data: perms } = await sb
    .from("role_permissions")
    .select("permission_key")
    .in("role_id", roleIds)
    .eq("permission_key", permission);

  return (perms?.length ?? 0) > 0;
}

/** True if the user holds the permission on any tenant (platform_owner). */
export async function userHasPermissionAnyTenant(
  userId: string,
  permission: Permission,
  reqOrDb?: Request | SupabaseClient
): Promise<boolean> {
  const sb = resolveDb(reqOrDb);
  const { data: rows } = await sb
    .from("user_roles")
    .select("role_id")
    .eq("user_id", userId)
    .is("scope_basket_id", null);

  if (!rows?.length) return false;
  const roleIds = rows.map((r) => r.role_id as string);
  const { data: perms } = await sb
    .from("role_permissions")
    .select("permission_key")
    .in("role_id", roleIds)
    .eq("permission_key", permission);

  return (perms?.length ?? 0) > 0;
}
