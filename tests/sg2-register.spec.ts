import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loginAs, SEED } from "./helpers";
import { DUOSIS_TENANT_ID } from "../lib/tenant";
import { DEV_AUTH_PASSWORD } from "../lib/dev-auth";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function admin() {
  return createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

test.describe("SG2 self-serve register", () => {
  test("unknown domain: create workspace → home", async ({ page }) => {
    const email = `sg2create_${Date.now()}@gmail.com`;
    const sb = admin();
    await sb.auth.admin.createUser({
      email,
      password: DEV_AUTH_PASSWORD,
      email_confirm: true,
    });

    await page.goto("/register");
    await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) localStorage.removeItem(k);
    });
    await page.goto("/register");

    await page.getByPlaceholder(/iş e-postan/i).fill(email);
    await page.getByPlaceholder(/şifre/i).fill(DEV_AUTH_PASSWORD);
    await page.getByRole("button", { name: "Devam" }).click();

    await expect(page.getByRole("button", { name: /Çalışma alanı oluştur/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: /Çalışma alanı oluştur/i }).click();
    await page.getByPlaceholder(/Çalışma alanı adı/i).fill("SG2 Test Co");
    await page.getByRole("button", { name: "Oluştur" }).click();

    await expect(page.getByRole("button", { name: /Yeni sepet|\+ Yeni/i }).first()).toBeVisible({
      timeout: 25_000,
    });

    const { data: au } = await sb
      .from("app_users")
      .select("tenant_id")
      .eq("email", email)
      .maybeSingle();
    expect(au?.tenant_id).toBeTruthy();
    expect(au?.tenant_id).not.toBe(DUOSIS_TENANT_ID);
  });

  test("known domain: register joins DuoSis", async ({ page }) => {
    const email = `sg2join_${Date.now()}@duosis.dev`;
    const sb = admin();
    await sb.auth.admin.createUser({
      email,
      password: DEV_AUTH_PASSWORD,
      email_confirm: true,
    });

    await page.goto("/register");
    await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) localStorage.removeItem(k);
    });
    await page.goto("/register");

    await page.getByPlaceholder(/iş e-postan/i).fill(email);
    await page.getByPlaceholder(/şifre/i).fill(DEV_AUTH_PASSWORD);
    await page.getByRole("button", { name: "Devam" }).click();

    await expect(page.getByRole("button", { name: /Yeni sepet|\+ Yeni/i }).first()).toBeVisible({
      timeout: 25_000,
    });

    // Membership is written via ensure_app_membership RPC; poll briefly for assert.
    let tenantId: string | null = null;
    for (let i = 0; i < 10; i++) {
      const { data: au } = await sb
        .from("app_users")
        .select("tenant_id")
        .ilike("email", email)
        .maybeSingle();
      tenantId = (au?.tenant_id as string) ?? null;
      if (tenantId) break;
      await page.waitForTimeout(200);
    }
    expect(tenantId).toBe(DUOSIS_TENANT_ID);
  });

  test("invite code joins existing tenant", async ({ page }) => {
    const sb = admin();
    const { data: code, error } = await sb.rpc("create_tenant_invite", {
      p_tenant_id: DUOSIS_TENANT_ID,
    });
    // service role may lack JWT — insert invite directly
    let invite = code as string | null;
    if (error || !invite) {
      invite = `T${Date.now().toString(36).toUpperCase().slice(-7)}`.slice(0, 8);
      await sb.from("tenant_invites").insert({
        tenant_id: DUOSIS_TENANT_ID,
        code: invite,
        created_by: SEED.adminEmail,
      });
    }

    const email = `sg2inv_${Date.now()}@hotmail.com`;
    await sb.auth.admin.createUser({
      email,
      password: DEV_AUTH_PASSWORD,
      email_confirm: true,
    });

    await page.goto("/register");
    await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) localStorage.removeItem(k);
    });
    await page.goto("/register");

    await page.getByPlaceholder(/iş e-postan/i).fill(email);
    await page.getByPlaceholder(/şifre/i).fill(DEV_AUTH_PASSWORD);
    await page.getByRole("button", { name: "Devam" }).click();
    await expect(page.getByRole("button", { name: /Davet koduyla katıl/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: /Davet koduyla katıl/i }).click();
    await page.getByPlaceholder(/Davet kodu/i).fill(invite!);
    await page.getByRole("button", { name: "Katıl" }).click();

    await expect(page.getByRole("button", { name: /Yeni sepet|\+ Yeni/i }).first()).toBeVisible({
      timeout: 25_000,
    });

    const { data: au } = await sb
      .from("app_users")
      .select("tenant_id")
      .eq("email", email)
      .maybeSingle();
    expect(au?.tenant_id).toBe(DUOSIS_TENANT_ID);
  });

  test("isolation: new tenant cannot see DuoSis baskets", async ({ page }) => {
    const email = `sg2iso_${Date.now()}@gmail.com`;
    const sb = admin();
    await sb.auth.admin.createUser({
      email,
      password: DEV_AUTH_PASSWORD,
      email_confirm: true,
    });
    const { data: tid, error } = await sb.rpc("create_tenant_for_user", {
      p_name: "Iso Co",
      p_domain: null,
      p_email: email,
    });
    expect(error).toBeNull();
    expect(tid).toBeTruthy();
    expect(tid).not.toBe(DUOSIS_TENANT_ID);

    await loginAs(page, { email, name: "Iso" });
    await page.goto("/");
    await expect(page.getByRole("button", { name: /Yeni sepet|\+ Yeni/i }).first()).toBeVisible();
    // Seed DuoSis basket titles must not appear (do not match tab labels like "Hackathon")
    await expect(page.getByText("Seed: Akşam nereye?")).toHaveCount(0);
    await expect(page.getByText("Seed: İç Hackathon")).toHaveCount(0);
    await expect(page.locator(`a[href="/basket/${SEED.etkinlikId}"]`)).toHaveCount(0);
  });
});
