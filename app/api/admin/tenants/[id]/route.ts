import { NextResponse } from "next/server";
import {
  resolveIdentity,
  supabaseAdmin,
  userHasPermission,
  userHasPermissionAnyTenant,
} from "@/lib/server-auth";

type Ctx = { params: Promise<{ id: string }> };

async function requirePlatformAdmin(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  const can =
    (await userHasPermission(
      identity.tenantId,
      identity.userId,
      "platform.manage_tenants"
    )) ||
    (await userHasPermissionAnyTenant(identity.userId, "platform.manage_tenants"));
  if (!can) return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  return { identity };
}

export async function GET(req: Request, ctx: Ctx) {
  const gate = await requirePlatformAdmin(req);
  if ("error" in gate && gate.error) return gate.error;

  const { id } = await ctx.params;
  const sb = supabaseAdmin();
  const { data: tenant, error } = await sb
    .from("tenants")
    .select("id, name, email_domain, plan, status, created_at, azure_tenant_id, settings")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!tenant) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [{ data: domains }, { data: users }, { data: assignments }, { data: roles }] =
    await Promise.all([
      sb.from("tenant_domains").select("domain").eq("tenant_id", id),
      sb.from("app_users").select("user_id, email, display_name, created_at").eq("tenant_id", id),
      sb
        .from("user_roles")
        .select("user_id, role_id, scope_basket_id")
        .eq("tenant_id", id)
        .is("scope_basket_id", null),
      sb.from("roles").select("id, key, label").or(`tenant_id.is.null,tenant_id.eq.${id}`),
    ]);

  const roleById = new Map((roles ?? []).map((r) => [r.id as string, r]));
  const rolesByUser = new Map<string, { key: string; label: string }[]>();
  for (const a of assignments ?? []) {
    const r = roleById.get(a.role_id as string);
    if (!r) continue;
    const uid = a.user_id as string;
    const list = rolesByUser.get(uid) ?? [];
    list.push({ key: r.key as string, label: r.label as string });
    rolesByUser.set(uid, list);
  }

  return NextResponse.json({
    tenant: {
      ...tenant,
      domains: (domains ?? []).map((d) => d.domain as string),
    },
    users: (users ?? []).map((u) => ({
      ...u,
      roles: rolesByUser.get(u.user_id as string) ?? [],
    })),
  });
}
