import { test, expect } from "@playwright/test";
import { loginAs, SEED } from "./helpers";
import { DUOSIS_TENANT_ID, OTHER_TENANT_ID } from "../lib/tenant";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const ARCHIVE_ETKINLIK = "99999999-9999-4999-8999-999999999999";
const ARCHIVE_HACK = "aaaa1111-1111-4111-8111-111111111111";

function headers(email: string, tenantId = DUOSIS_TENANT_ID) {
  return {
    "Content-Type": "application/json",
    "X-Dev-User": JSON.stringify({ email, tenantId }),
  };
}

test.describe("S5 Archive", () => {
  test("etkinlik result page shows winner + votes", async ({ page }) => {
    await loginAs(page);
    await page.goto(`/basket/${ARCHIVE_ETKINLIK}/result`);
    await expect(page.getByTestId("result-page")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("result-winner")).toContainText("Arşiv kazanan fikir");
    await expect(page.getByTestId("result-ideas")).toContainText("Arşiv kaybeden fikir");
    await expect(page.getByTestId("result-vote-count")).toContainText("2 oy");
  });

  test("hackathon result page shows team + participant + feedback", async ({ page }) => {
    await loginAs(page);
    await page.goto(`/basket/${ARCHIVE_HACK}/result`);
    await expect(page.getByTestId("result-winner")).toContainText("Arşiv hackathon fikri");
    await expect(page.getByTestId("result-participants")).toContainText("Member");
    await expect(page.getByTestId("result-teams")).toContainText("Squad Alpha");
    await expect(page.getByTestId("result-feedback")).toContainText("Harika demo");
  });

  test("archive list + CSV content", async ({ page, request }) => {
    await loginAs(page);
    await page.goto("/archive");
    await expect(page.getByTestId("archive-list")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Seed: Arşiv Etkinlik")).toBeVisible();
    await expect(page.getByText("Seed: Arşiv Hackathon")).toBeVisible();

    await page.getByTestId("archive-filter-type").selectOption("etkinlik");
    await expect(page.getByText("Seed: Arşiv Hackathon")).toHaveCount(0);
    await expect(page.getByText("Seed: Arşiv Etkinlik")).toBeVisible();

    await page.getByTestId(`archive-row-${ARCHIVE_ETKINLIK}`).click();
    await expect(page).toHaveURL(new RegExp(`/basket/${ARCHIVE_ETKINLIK}/result`));

    const csv = await request.get(`${BASE}/api/archive/${ARCHIVE_ETKINLIK}/csv`, {
      headers: headers("admin@duosis.dev"),
    });
    expect(csv.status()).toBe(200);
    const text = await csv.text();
    expect(text).toContain("Seed: Arşiv Etkinlik");
    expect(text).toContain("Arşiv kazanan fikir");
    expect(text).toContain("is_winner,yes");
  });

  test("member without archive.view_all only sees participated baskets", async ({ request }) => {
    // Create a resolved basket member never touched
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    const secretId = "ffff6666-6666-4666-8666-666666666666";
    await sb.from("baskets").delete().eq("id", secretId);
    await sb.from("baskets").insert({
      id: secretId,
      title: "Admin-only archive secret",
      type: "etkinlik",
      resolve_method: "vote",
      phase: "resolved",
      status: "resolved",
      created_by: "admin@duosis.dev",
      tenant_id: DUOSIS_TENANT_ID,
    });

    const adminList = await request.get(`${BASE}/api/archive`, {
      headers: headers("admin@duosis.dev"),
    });
    expect(adminList.status()).toBe(200);
    const adminBody = await adminList.json();
    expect(adminBody.viewAll).toBe(true);
    expect(adminBody.baskets.some((b: { id: string }) => b.id === secretId)).toBe(true);

    const memberList = await request.get(`${BASE}/api/archive`, {
      headers: headers("member@duosis.dev"),
    });
    expect(memberList.status()).toBe(200);
    const memberBody = await memberList.json();
    expect(memberBody.viewAll).toBe(false);
    expect(memberBody.baskets.some((b: { id: string }) => b.id === secretId)).toBe(false);
    // member voted on archive etkinlik → should see it
    expect(memberBody.baskets.some((b: { id: string }) => b.id === ARCHIVE_ETKINLIK)).toBe(true);

    await sb.from("baskets").delete().eq("id", secretId);
  });

  test("Other Corp cannot list DuoSis archive", async ({ request }) => {
    const res = await request.get(`${BASE}/api/archive`, {
      headers: headers("admin@other.com", OTHER_TENANT_ID),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.baskets.some((b: { title: string }) => /Arşiv/.test(b.title))).toBe(false);
  });
});
