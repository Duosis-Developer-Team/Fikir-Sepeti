import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loginAs, expectHome, SEED } from "./helpers";
import { DUOSIS_TENANT_ID, OTHER_TENANT_ID } from "../lib/tenant";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

test.describe("S1 tenant isolation (app layer)", () => {
  test("no row has null tenant_id", async () => {
    const sb = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY || anon, {
      auth: { persistSession: false },
    });
    for (const table of [
      "baskets",
      "ideas",
      "votes",
      "teams",
      "team_members",
      "team_votes",
      "feedback",
      "hackathon_participants",
      "squad_members",
    ]) {
      const { data, error } = await sb.from(table).select("id").is("tenant_id", null).limit(1);
      expect(error, table).toBeNull();
      expect(data ?? [], `${table} null tenant_id`).toHaveLength(0);
    }
  });

  test("DuoSis user does not see Other Corp baskets on home", async ({ page }) => {
    await loginAs(page, { email: SEED.adminEmail, name: SEED.adminName });
    await expectHome(page);
    await page.getByTestId("tab-etkinlik").click();
    await expect(page.getByText("Other Corp Secret")).toHaveCount(0);
    // Seed Duo basket may appear
    await expect(page.getByText("Seed: Akşam nereye?").or(page.getByText("Yeni sepet")).first()).toBeVisible();
  });

  test("Other Corp user does not see DuoSis baskets", async ({ page }) => {
    await loginAs(page, { email: "admin@other.com", name: "Other Admin" });
    await page.goto("/");
    await expect(page.getByRole("button", { name: /Yeni sepet|Yeni/i }).first()).toBeVisible();
    await page.getByTestId("tab-etkinlik").click();
    await expect(page.getByText("Seed: Akşam nereye?")).toHaveCount(0);
    await expect(page.getByText("Seed: Other Corp Secret")).toBeVisible();
  });

  test("cannot open foreign tenant basket by deep link", async ({ page }) => {
    await loginAs(page, { email: SEED.adminEmail, name: SEED.adminName });
    await page.goto("/basket/55555555-5555-4555-8555-555555555555");
    await expect(page.getByText(/bulunamadı|yok|Sepet yok/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("tenant ids are stable seed constants", () => {
    expect(DUOSIS_TENANT_ID).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(OTHER_TENANT_ID).toBe("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  });
});
