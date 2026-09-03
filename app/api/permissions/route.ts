import { NextResponse } from "next/server";
import { getDb, resolveIdentity } from "@/lib/server-auth";
import { isPermission, type Permission } from "@/lib/permissions";

/**
 * GET /api/permissions?keys=hackathon.jury,analytics.view&basketId=
 * Returns which of the requested permissions the caller holds.
 *
 * userHasPermission() re-fetches user_roles + role_permissions per key (2
 * queries each) — fine for a single scoped check, but the client-wide
 * permission gate asks for the full catalog (13 keys) on every page, which
 * would be 26 round trips. Roles only need fetching once; do that here and
 * intersect against role_permissions in a single IN() query instead.
 */
export async function GET(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const keys = (url.searchParams.get("keys") ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(isPermission) as Permission[];
  const basketId = url.searchParams.get("basketId");

  const result: Record<string, boolean> = {};
  for (const key of keys) result[key] = false;
  if (!keys.length) return NextResponse.json({ permissions: result });

  const sb = getDb(req);
  const { data: roleRows } = await sb
    .from("user_roles")
    .select("role_id, scope_basket_id")
    .eq("tenant_id", identity.tenantId)
    .eq("user_id", identity.userId);

  const roleIds = ((roleRows ?? []) as { role_id: string; scope_basket_id: string | null }[])
    .filter((r) => r.scope_basket_id == null || (!!basketId && r.scope_basket_id === basketId))
    .map((r) => r.role_id);

  if (roleIds.length) {
    const { data: permRows } = await sb
      .from("role_permissions")
      .select("permission_key")
      .in("role_id", roleIds)
      .in("permission_key", keys);
    for (const row of (permRows ?? []) as { permission_key: string }[]) {
      result[row.permission_key] = true;
    }
  }

  return NextResponse.json({ permissions: result });
}
