import { expect, type Page } from "@playwright/test";

export const SEED = {
  adminEmail: "admin@duosis.dev",
  adminName: "Admin",
  memberEmail: "member@duosis.dev",
  etkinlikId: "11111111-1111-4111-8111-111111111111",
  hackathonId: "22222222-2222-4222-8222-222222222222",
};

/** Login via AuthGate bypass UI (signs in with seeded password → JWT for RLS). */
export async function loginAs(
  page: Page,
  user: { email: string; name?: string } = {
    email: SEED.adminEmail,
    name: SEED.adminName,
  }
) {
  await page.goto("/");
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) localStorage.removeItem(k);
  });
  await page.goto("/");

  const input = page.getByPlaceholder(/Adın ya da iş e-postan/i);
  await expect(input).toBeVisible({ timeout: 15_000 });
  await input.fill(user.email);
  await page.getByRole("button", { name: "Devam" }).click();

  // Overlay must close — Yeni sepet lives under AuthGate even when logged out
  await expect(input).toBeHidden({ timeout: 20_000 });
  await expect(page.getByText(/Giriş başarısız|tanımsız tenant/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Yeni sepet|\+ Yeni/i }).first()).toBeVisible();
}

export async function expectHome(page: Page) {
  await expect(page.getByPlaceholder(/Adın ya da iş e-postan/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Yeni sepet|Yeni/i }).first()).toBeVisible();
}

export async function openNewBasketModal(page: Page) {
  await page.getByRole("button", { name: /Yeni sepet|\+ Yeni/i }).first().click();
  await expect(page.getByRole("heading", { name: "Yeni sepet" })).toBeVisible();
}

/** Scope to the NewBasketModal panel (avoids colliding with home mode tabs). */
export function newBasketModal(page: Page) {
  return page.locator("div").filter({ has: page.getByRole("heading", { name: "Yeni sepet" }) }).last();
}
