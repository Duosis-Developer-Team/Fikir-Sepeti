import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Permission } from "./permissions";

let _admin: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY required for server operations");
  }
  _admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

export type RequestIdentity = {
  userId: string;
  email: string;
  tenantId: string;
};

export async function resolveIdentity(req: Request): Promise<RequestIdentity | null> {
  const bypass = process.env.NEXT_PUBLIC_AUTH_BYPASS === "1";
  const devHeader = req.headers.get("x-dev-user");
  if (bypass && devHeader) {
    try {
      const u = JSON.parse(devHeader) as {
        email?: string;
        tenantId?: string;
      };
      if (u.email && u.tenantId) {
        return { userId: u.email, email: u.email, tenantId: u.tenantId };
      }
    } catch {
      /* ignore */
    }
  }

  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7);
  const sb = supabaseAdmin();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user?.email) return null;

  const email = data.user.email;
  const { data: appUser } = await sb
    .from("app_users")
    .select("tenant_id, user_id")
    .eq("email", email)
    .maybeSingle();
  if (!appUser) return null;
  return {
    userId: appUser.user_id as string,
    email,
    tenantId: appUser.tenant_id as string,
  };
}

export async function userHasPermission(
  tenantId: string,
  userId: string,
  permission: Permission,
  scopeBasketId?: string | null
): Promise<boolean> {
  const sb = supabaseAdmin();
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
