import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import { DUOSIS_TENANT_ID, OTHER_TENANT_ID } from "../lib/tenant";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const ARCHIVE_HACK = "aaaa1111-1111-4111-8111-111111111111";

function headers(email: string, tenantId = DUOSIS_TENANT_ID) {
  return {
    "Content-Type": "application/json",
    "X-Dev-User": JSON.stringify({ email, tenantId }),
  };
}

test.describe("S8 Analytics", () => {
  test("teaser available without full permission gate on default GET", async ({
    request,
  }) => {
    const res = await request.get(`${BASE}/api/analytics`, {
      headers: headers("member@duosis.dev"),
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.teaser).toBeTruthy();
    expect(json.teaser.headline).toBeTruthy();
    expect(typeof json.canViewFull).toBe("boolean");
  });

  test("full detail requires analytics.view — member 403", async ({
    request,
  }) => {
    const res = await request.get(`${BASE}/api/analytics?full=1`, {
      headers: headers("member@duosis.dev"),
    });
    expect(res.status()).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/analytics\.view/i);
  });

  test("admin full funnel + production list + effort update", async ({
    request,
  }) => {
    const res = await request.get(`${BASE}/api/analytics?full=1`, {
      headers: headers("admin@duosis.dev"),
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.funnel).toHaveLength(5);
    const keys = json.funnel.map((s: { key: string }) => s.key);
    expect(keys).toEqual([
      "ideas",
      "voted",
      "organized",
      "done",
      "production",
    ]);
    expect(json.funnel[0].count).toBeGreaterThan(0);
    expect(json.retention).toBeTruthy();
    expect(Array.isArray(json.production)).toBe(true);
    expect(
      json.production.some((p: { id: string }) => p.id === ARCHIVE_HACK)
    ).toBe(true);

    const patch = await request.patch(`${BASE}/api/analytics/production`, {
      headers: headers("admin@duosis.dev"),
      data: {
        basketId: ARCHIVE_HACK,
        production_note: "E2E production note",
        effort_estimate: 4.5,
      },
    });
    expect(patch.status()).toBe(200);
    const updated = await patch.json();
    expect(updated.basket.production_note).toBe("E2E production note");
    expect(Number(updated.basket.effort_estimate)).toBe(4.5);

    const again = await request.get(`${BASE}/api/analytics?full=1`, {
      headers: headers("admin@duosis.dev"),
    });
    const full = await again.json();
    const row = full.production.find((p: { id: string }) => p.id === ARCHIVE_HACK);
    expect(row.production_note).toBe("E2E production note");
  });

  test("tenant isolation — other tenant teaser has no Duo production", async ({
    request,
  }) => {
    const res = await request.get(`${BASE}/api/analytics`, {
      headers: headers("admin@other.com", OTHER_TENANT_ID),
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.teaser.productionCount).toBe(0);

    const full = await request.get(`${BASE}/api/analytics?full=1`, {
      headers: headers("admin@other.com", OTHER_TENANT_ID),
    });
    // organizer has no analytics.view → 403 (cannot leak Duo detail)
    expect(full.status()).toBe(403);
  });

  test("analytics page shows teaser + funnel for admin", async ({ page }) => {
    await loginAs(page);
    await page.goto("/analytics");
    await expect(page.getByTestId("analytics-page")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("analytics-teaser")).toBeVisible();
    await expect(page.getByTestId("analytics-funnel")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("funnel-ideas")).toBeVisible();
    await expect(page.getByTestId("analytics-retention")).toBeVisible();
    await expect(page.getByTestId("analytics-production")).toBeVisible();
  });
});
