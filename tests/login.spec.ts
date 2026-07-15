import { test, expect } from "@playwright/test";
import { loginAs, SEED } from "./helpers";

test.describe("login page + tenant gate", () => {
  test("unauthenticated / redirects to /login", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) localStorage.removeItem(k);
    });
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Fikir Sepeti" })).toBeVisible();
    await expect(page.getByPlaceholder(/Adın ya da iş e-postan/i)).toBeVisible();
  });

  test("known domain login succeeds and lands on home", async ({ page }) => {
    await loginAs(page, { email: SEED.adminEmail, name: SEED.adminName });
    await expect(page.getByRole("button", { name: /Yeni sepet|\+ Yeni/i }).first()).toBeVisible();
  });

  test("unknown domain shows tenant denied", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) localStorage.removeItem(k);
    });
    await page.goto("/login");

    const input = page.getByPlaceholder(/Adın ya da iş e-postan/i);
    await expect(input).toBeVisible({ timeout: 15_000 });
    await input.fill("x@unknown.com");
    await page.getByRole("button", { name: "Devam" }).click();

    await expect(page.getByText(/tanımlı çalışma alanı yok/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("x@unknown.com")).toBeVisible();
    await expect(page.getByRole("button", { name: /Yeni sepet|\+ Yeni/i })).toHaveCount(0);
  });
});
