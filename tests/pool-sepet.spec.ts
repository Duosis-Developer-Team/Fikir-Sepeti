import { test, expect } from "@playwright/test";
import { loginAs, SEED } from "./helpers";
import { DUOSIS_TENANT_ID } from "../lib/tenant";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

function headers(email: string) {
  return {
    "Content-Type": "application/json",
    "X-Dev-User": JSON.stringify({ email, tenantId: DUOSIS_TENANT_ID }),
  };
}

test.describe("S4 Sepet E2E", () => {
  test("three tabs + create + vote on pool idea", async ({ page }) => {
    const unique = `E2E sepet fikri ${Date.now()}`;
    await loginAs(page);
    await expect(page.getByTestId("home-mode-tabs")).toBeVisible();
    await expect(page.getByTestId("tab-sepet")).toBeVisible();
    await expect(page.getByTestId("tab-hackathon")).toBeVisible();
    await expect(page.getByTestId("tab-etkinlik")).toBeVisible();

    await page.getByTestId("pool-idea-input").fill(unique);
    await page.getByTestId("pool-submit").click();
    const card = page.locator("[data-testid^='pool-card-']").filter({ hasText: unique }).first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.getByRole("button", { name: /oy ver/i }).click();
    await expect(card.getByRole("button", { name: /oyun/i })).toBeVisible({ timeout: 10_000 });
  });

  test("poll open — second user adds option", async ({ page, browser, request }) => {
    const optionText = `E2E yeni poll seçeneği ${Date.now()}`;
    const create = await request.post(`${BASE}/api/pool`, {
      headers: headers("admin@duosis.dev"),
      data: {
        text: `E2E poll option seed ${Date.now()}`,
        poll_closes_at: new Date(Date.now() + 3600_000).toISOString(),
        status: "voting",
      },
    });
    expect(create.status()).toBe(200);

    await loginAs(page, { email: SEED.adminEmail, name: SEED.adminName });
    await expect(page.getByTestId("pool-add-option")).toBeVisible({ timeout: 15_000 });

    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await loginAs(page2, { email: SEED.memberEmail, name: "Member" });
    await page2.getByTestId("pool-option-input").fill(optionText);
    await page2.getByTestId("pool-option-submit").click();
    await expect(
      page2.locator("[data-testid^='pool-card-']").filter({ hasText: optionText }).first()
    ).toBeVisible({ timeout: 15_000 });
    await ctx2.close();
  });

  test("promote etkinlik → resolve → pool shows winner + return loser", async ({ page, request }) => {
    const stamp = Date.now();
    const primaryText = `E2E promote primary ${stamp}`;
    const loserText = `E2E loser for jar ${stamp}`;
    const basketTitle = `E2E promote etkinlik ${stamp}`;

    const create = await request.post(`${BASE}/api/pool`, {
      headers: headers("admin@duosis.dev"),
      data: { text: primaryText, category: "ürün" },
    });
    const { idea } = await create.json();

    const promote = await request.post(`${BASE}/api/pool/promote`, {
      headers: headers("admin@duosis.dev"),
      data: {
        pool_idea_ids: [idea.id],
        type: "etkinlik",
        title: basketTitle,
      },
    });
    expect(promote.status()).toBe(200);
    const { basketId } = await promote.json();

    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    const { data: loser } = await sb
      .from("ideas")
      .insert({
        basket_id: basketId,
        text: loserText,
        created_by: "admin@duosis.dev",
        tenant_id: DUOSIS_TENANT_ID,
      })
      .select()
      .single();

    await loginAs(page);
    await page.goto(`/basket/${basketId}`);
    await expect(page.getByRole("heading", { name: basketTitle })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Sepet bulunamadı.")).toHaveCount(0);
    await expect(page.getByText(primaryText).first()).toBeVisible({ timeout: 15_000 });

    // vote for primary then resolve
    const primaryVote = page.getByRole("button", { name: /oy ver/i }).first();
    if (await primaryVote.isVisible().catch(() => false)) {
      await primaryVote.click();
    }
    const finish = page.getByRole("button", { name: /Oylamayı bitir/i });
    await expect(finish).toBeVisible({ timeout: 10_000 });
    await finish.click();
    await expect(page.getByText("Kazanan")).toBeVisible({ timeout: 15_000 });

    await page.getByTestId(`return-idea-${loser!.id}`).click();
    await expect(page.getByText("✓ sepetinde")).toBeVisible({ timeout: 10_000 });

    await page.goto("/");
    await page.getByTestId("tab-sepet").click();
    await expect(page.getByTestId(`pool-used-${idea.id}`)).toContainText(/kazanan|kullanıldı/i, {
      timeout: 15_000,
    });
    const loserCard = page.locator("[data-testid^='pool-card-']").filter({ hasText: loserText }).first();
    await expect(loserCard).toBeVisible();
    await expect(loserCard.locator("[data-testid^='pool-source-']")).toBeVisible();
  });

  test("fast path still opens basket without visiting sepet tab content", async ({ page }) => {
    await loginAs(page);
    await page.getByTestId("tab-etkinlik").click();
    await page.getByRole("button", { name: /Yeni sepet|\+ Yeni/i }).first().click();
    await expect(page.getByRole("heading", { name: "Yeni sepet" })).toBeVisible();
  });
});
