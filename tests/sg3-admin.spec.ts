import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loginAs, SEED } from "./helpers";
import { DUOSIS_TENANT_ID, OTHER_TENANT_ID } from "../lib/tenant";
import { isPermission, PERMISSIONS } from "../lib/permissions";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function adminSb() {
  return createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function devHeaders(email: string, tenantId: string) {
  return {
    "Content-Type": "application/json",
    "X-Dev-User": JSON.stringify({ email, tenantId }),
  };
}

test.describe("SG3 platform admin", () => {
  test("permission catalog includes platform.manage_tenants", () => {
    expect(isPermission("platform.manage_tenants")).toBe(true);
    expect(PERMISSIONS).toContain("platform.manage_tenants");
  });

  test("tenant_admin cannot list tenants (403)", async ({ request }) => {
    const res = await request.get("/api/admin/tenants", {
      headers: devHeaders(SEED.memberEmail, DUOSIS_TENANT_ID),
    });
    expect(res.status()).toBe(403);
  });

  test("platform_owner lists tenants and can patch plan/status", async ({
    request,
  }) => {
    const list = await request.get("/api/admin/tenants", {
      headers: devHeaders(SEED.adminEmail, DUOSIS_TENANT_ID),
    });
    expect(list.status()).toBe(200);
    const body = await list.json();
    expect(body.tenants.length).toBeGreaterThanOrEqual(2);
    const ids = body.tenants.map((t: { id: string }) => t.id);
    expect(ids).toContain(DUOSIS_TENANT_ID);
    expect(ids).toContain(OTHER_TENANT_ID);

    const patch = await request.patch("/api/admin/tenants", {
      headers: devHeaders(SEED.adminEmail, DUOSIS_TENANT_ID),
      data: { tenantId: OTHER_TENANT_ID, plan: "analytics", status: "suspended" },
    });
    expect(patch.status()).toBe(200);
    const patched = await patch.json();
    expect(patched.tenant.plan).toBe("analytics");
    expect(patched.tenant.status).toBe("suspended");

    // restore for other tests
    await request.patch("/api/admin/tenants", {
      headers: devHeaders(SEED.adminEmail, DUOSIS_TENANT_ID),
      data: { tenantId: OTHER_TENANT_ID, plan: "free", status: "active" },
    });
  });

  test("suspended tenant resolve returns null", async () => {
    const sb = adminSb();
    await sb
      .from("tenants")
      .update({ status: "suspended" })
      .eq("id", OTHER_TENANT_ID);
    const { data } = await sb.rpc("resolve_tenant_for_claims", {
      p_email: "admin@other.com",
      p_azure_tid: null,
    });
    expect(data).toBeNull();
    await sb.from("tenants").update({ status: "active" }).eq("id", OTHER_TENANT_ID);
  });

  test("admin UI loads for platform owner", async ({ page }) => {
    await loginAs(page, { email: SEED.adminEmail, name: SEED.adminName });
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: /Platform · Tenantlar/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("DuoSis")).toBeVisible();
    await expect(page.getByText("Other Corp")).toBeVisible();
  });

  test("member cannot use admin UI", async ({ page }) => {
    await loginAs(page, { email: SEED.memberEmail, name: "Member" });
    await page.goto("/admin");
    await expect(page.getByText(/platform\.manage_tenants izni gerekli/i)).toBeVisible({
      timeout: 15_000,
    });
  });
});
