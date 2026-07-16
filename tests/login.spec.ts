import { test, expect } from "@playwright/test";
import { loginAs, SEED } from "./helpers";

test.describe("login page + tenant gate", () => {
  test("unauthenticated / shows landing (not forced login)", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) localStorage.removeItem(k);
    });
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /Fikirden prototipe/i })).toBeVisible();
  });

  test("unauthenticated /login shows login form", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) localStorage.removeItem(k);
    });
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Fikir Sepeti" })).toBeVisible();
    await expect(page.getByPlaceholder(/Adın ya da iş e-postan/i)).toBeVisible();
  });

  test("known domain login succeeds and lands on home", async ({ page }) => {
    await loginAs(page, { email: SEED.adminEmail, name: SEED.adminName });
    await expect(page.getByRole("button", { name: /Yeni sepet|\+ Yeni/i }).first()).toBeVisible();
  });

  test("unknown domain on login goes to register onboarding", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) localStorage.removeItem(k);
    });
    await page.goto("/login");

    const input = page.getByPlaceholder(/Adın ya da iş e-postan/i);
    await expect(input).toBeVisible({ timeout: 15_000 });
    await input.fill(`x_${Date.now()}@unknown.com`);
    await page.getByRole("button", { name: "Devam" }).click();

    await expect(page).toHaveURL(/\/register/, { timeout: 20_000 });
    await expect(page.getByRole("button", { name: /Çalışma alanı oluştur|Davet koduyla katıl/i }).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
