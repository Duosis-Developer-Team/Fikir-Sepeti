import { test, expect } from "@playwright/test";
import { loginAs, expectHome, openNewBasketModal, SEED } from "./helpers";

test.describe("smoke: etkinlik", () => {
  test("fikir ekle → oy ver → sonucu çek", async ({ page }) => {
    await loginAs(page, { email: SEED.adminEmail, name: SEED.adminName });
    await expectHome(page);

    await openNewBasketModal(page);
    await page.getByPlaceholder(/Ne konuşuyoruz/i).fill("Smoke: Öğle yemeği");
    await page.getByRole("button", { name: "Etkinlik" }).click();
    await page.getByRole("button", { name: "Oylama" }).click();
    await page.getByRole("button", { name: "Oluştur" }).click();

    await expect(page).toHaveURL(/\/basket\//);
    await expect(page.getByPlaceholder("Fikrini yaz…")).toBeVisible();

    await page.getByPlaceholder("Fikrini yaz…").fill("Dürüm");
    await page.getByRole("button", { name: "Ekle" }).click();
    await expect(page.getByText("Dürüm").first()).toBeVisible();

    await page.getByPlaceholder("Fikrini yaz…").fill("Mantı");
    await page.getByRole("button", { name: "Ekle" }).click();
    await expect(page.getByText("Mantı").first()).toBeVisible();

    await page.getByRole("button", { name: "oy ver" }).first().click();
    await expect(page.getByRole("button", { name: "oyun ✓" })).toBeVisible();

    await page.getByRole("button", { name: /Oylamayı bitir/i }).click();
    await expect(page.getByText("Kazanan")).toBeVisible({ timeout: 20_000 });
  });
});
