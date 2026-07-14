import { test, expect } from "@playwright/test";
import { loginAs, expectHome, openNewBasketModal, SEED } from "./helpers";

test.describe("smoke: hackathon", () => {
  test("lobby → idea → team → demo", async ({ page }) => {
    await loginAs(page, { email: SEED.adminEmail, name: SEED.adminName });
    await expectHome(page);

    await openNewBasketModal(page);
    await page.getByPlaceholder(/Ne konuşuyoruz/i).fill("Smoke: İç Hackathon");
    await page.getByRole("button", { name: "Hackathon" }).click();
    await page.getByRole("button", { name: "Oluştur" }).click();

    await expect(page).toHaveURL(/\/basket\//);
    await expect(page.getByRole("button", { name: /Kuruluma geç/i })).toBeVisible();

    // Lobby wizard: invite → ideaSource → teamMode → duration → ready → start
    await page.getByRole("button", { name: /Kuruluma geç/i }).click();
    await page.getByRole("button", { name: "Fikir var" }).click();
    await page.getByRole("button", { name: "Herkes tek" }).click();
    await page.getByRole("button", { name: /Devam/i }).click();
    await page.getByRole("button", { name: /Başlat/i }).click();

    // Idea stage (static)
    const ideaBox = page.locator("textarea");
    await expect(ideaBox).toBeVisible({ timeout: 20_000 });
    await ideaBox.fill("Smoke bot fikri");
    await page.getByRole("button", { name: /Fikri belirle/i }).click();
    await expect(page.getByText("Smoke bot fikri").first()).toBeVisible();
    await expect(page.getByText("Fikir belli").or(page.getByText("belli")).first()).toBeVisible();

    // Orchestrator: Sonraki: Takım
    await page.getByRole("button", { name: /Sonraki: Takım/i }).click();
    await expect(page.getByRole("button", { name: /Oluştur/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /Oluştur/i }).click();
    await expect(page.getByText(/Takımlar|hazır/i).first()).toBeVisible({ timeout: 20_000 });

    // Jump to Demo via stepper (admin)
    await page.getByRole("button", { name: "Demo", exact: true }).click();
    await expect(page.getByText(/Demo|Sunum|takım/i).first()).toBeVisible({ timeout: 20_000 });
  });
});
