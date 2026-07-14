import { NextResponse } from "next/server";
import {
  resolveIdentity,
  supabaseAdmin,
  userHasPermission,
} from "@/lib/server-auth";

/** List roles + current user's role assignments (tenant admin). */
export async function GET(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const can = await userHasPermission(
    identity.tenantId,
    identity.userId,
    "tenant.manage_roles"
  );
  if (!can) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const sb = supabaseAdmin();
  const [{ data: roles }, { data: assignments }, { data: users }] = await Promise.all([
    sb.from("roles").select("id, key, label, is_system, tenant_id").or(`tenant_id.is.null,tenant_id.eq.${identity.tenantId}`),
    sb.from("user_roles").select("id, user_id, role_id, scope_basket_id").eq("tenant_id", identity.tenantId),
    sb.from("app_users").select("user_id, email, display_name").eq("tenant_id", identity.tenantId),
  ]);

  const { data: perms } = await sb
    .from("role_permissions")
    .select("role_id, permission_key")
    .in(
      "role_id",
      (roles ?? []).map((r) => r.id)
    );

  return NextResponse.json({
    roles: roles ?? [],
    permissions: perms ?? [],
    assignments: assignments ?? [],
    users: users ?? [],
  });
}

/** Assign / remove a role for a user. */
export async function POST(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const can = await userHasPermission(
    identity.tenantId,
    identity.userId,
    "tenant.manage_roles"
  );
  if (!can) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json()) as {
    action: "assign" | "revoke";
    userId: string;
    roleId: string;
    scopeBasketId?: string | null;
  };

  const sb = supabaseAdmin();
  if (body.action === "assign") {
    const { error } = await sb.from("user_roles").insert({
      tenant_id: identity.tenantId,
      user_id: body.userId,
      role_id: body.roleId,
      scope_basket_id: body.scopeBasketId ?? null,
    });
    if (error && error.code !== "23505") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    let q = sb
      .from("user_roles")
      .delete()
      .eq("tenant_id", identity.tenantId)
      .eq("user_id", body.userId)
      .eq("role_id", body.roleId);
    if (body.scopeBasketId) q = q.eq("scope_basket_id", body.scopeBasketId);
    else q = q.is("scope_basket_id", null);
    const { error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
