import { NextResponse } from "next/server";
import {
  resolveIdentity,
  getDb,
  userHasPermission,
  userHasPermissionAnyTenant,
} from "@/lib/server-auth";

async function requirePlatformAdmin(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  const can =
    (await userHasPermission(
      identity.tenantId,
      identity.userId,
      "platform.manage_tenants",
    req)) ||
    (await userHasPermissionAnyTenant(identity.userId, "platform.manage_tenants", req));
  if (!can) return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  return { identity };
}

export async function GET(req: Request) {
  const gate = await requirePlatformAdmin(req);
  if ("error" in gate && gate.error) return gate.error;

  const sb = getDb(req);
  const { data: tenants, error } = await sb
    .from("tenants")
    .select("id, name, email_domain, plan, status, created_at, azure_tenant_id")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (tenants ?? []).map((t) => t.id as string);
  const [{ data: domains }, { data: users }] = await Promise.all([
    sb.from("tenant_domains").select("tenant_id, domain").in("tenant_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    sb.from("app_users").select("tenant_id").in("tenant_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
  ]);

  const domainMap = new Map<string, string[]>();
  for (const d of domains ?? []) {
    const tid = d.tenant_id as string;
    const list = domainMap.get(tid) ?? [];
    list.push(d.domain as string);
    domainMap.set(tid, list);
  }
  const countMap = new Map<string, number>();
  for (const u of users ?? []) {
    const tid = u.tenant_id as string;
    countMap.set(tid, (countMap.get(tid) ?? 0) + 1);
  }

  return NextResponse.json({
    tenants: (tenants ?? []).map((t) => ({
      ...t,
      domains: domainMap.get(t.id as string) ?? (t.email_domain ? [t.email_domain] : []),
      user_count: countMap.get(t.id as string) ?? 0,
    })),
  });
}

export async function PATCH(req: Request) {
  const gate = await requirePlatformAdmin(req);
  if ("error" in gate && gate.error) return gate.error;

  const body = (await req.json()) as {
    tenantId: string;
    plan?: "free" | "analytics";
    status?: "active" | "suspended";
  };
  if (!body.tenantId) {
    return NextResponse.json({ error: "tenantId required" }, { status: 400 });
  }

  const patch: Record<string, string> = {};
  if (body.plan === "free" || body.plan === "analytics") patch.plan = body.plan;
  if (body.status === "active" || body.status === "suspended") patch.status = body.status;
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const sb = getDb(req);
  const { data, error } = await sb
    .from("tenants")
    .update(patch)
    .eq("id", body.tenantId)
    .select("id, name, plan, status")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tenant: data });
}
