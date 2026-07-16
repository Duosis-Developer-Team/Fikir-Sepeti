import { test, expect } from "@playwright/test";
import { loginAs, SEED } from "./helpers";

test.describe("SG1 landing", () => {
  test("unauthenticated / shows landing with layers and auth links", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) localStorage.removeItem(k);
    });
    await page.goto("/");

    await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /Fikirden prototipe/i })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Hesap" }).getByRole("link", { name: "Giriş" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Hesap" }).getByRole("link", { name: "Kayıt" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Katmanlar" }).getByText("Ücretsiz")).toBeVisible();
    await expect(page.getByRole("region", { name: "Katmanlar" }).getByText("Analitik")).toBeVisible();
    await expect(page.getByRole("region", { name: "Katmanlar" }).getByText("Entegrasyon")).toBeVisible();
  });

  test("Giriş and Kayıt navigate to correct routes", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) localStorage.removeItem(k);
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Fikirden prototipe/i })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("navigation", { name: "Hesap" }).getByRole("link", { name: "Giriş" }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

    await page.goto("/");
    await page.getByRole("navigation", { name: "Hesap" }).getByRole("link", { name: "Kayıt" }).click();
    await expect(page).toHaveURL(/\/register/, { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "Kayıt" })).toBeVisible();
  });

  test("authenticated / shows app home, not landing", async ({ page }) => {
    await loginAs(page, { email: SEED.adminEmail, name: SEED.adminName });
    await expect(page.getByRole("button", { name: /Yeni sepet|\+ Yeni/i }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /Fikirden prototipe/i })).toHaveCount(0);
  });
});
