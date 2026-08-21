import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loginAs, expectHome, openNewBasketModal, newBasketModal, SEED } from "./helpers";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

test.describe("smoke: hackathon", () => {
  test("lobby → idea → team → demo", async ({ page }) => {
    await loginAs(page, { email: SEED.adminEmail, name: SEED.adminName });
    await expectHome(page);

    await openNewBasketModal(page);
    const modal = newBasketModal(page);
    await page.getByPlaceholder(/Ne konuşuyoruz/i).fill("Smoke: İç Hackathon");
    await modal.getByRole("button", { name: /Hackathon/i }).click();
    await modal.getByRole("button", { name: "Oluştur" }).click();

    await expect(page).toHaveURL(/\/basket\//);
    await expect(page.getByRole("button", { name: /Kuruluma geç/i })).toBeVisible();

    // Lobby wizard: invite → ideaSource → teamMode → duration → scoring → ready → start
    await page.getByRole("button", { name: /Kuruluma geç/i }).click();
    await page.getByRole("button", { name: "Fikir var" }).click();
    await page.getByRole("button", { name: "Herkes tek" }).click();
    await page.getByRole("button", { name: /Devam/i }).click(); // duration → scoring
    await page.getByRole("button", { name: /Basit oy/i }).click(); // scoring → ready (keeps simple mode)
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

    // Admin stepper artık henüz ulaşılmamış aşamalara atlatmıyor (bkz. HackathonRunner) —
    // "hackathon" fazının süresi (varsayılan 1 gün) gerçek zamanda beklenemeyeceği için
    // Demo/Sunum'a servis rolüyle doğrudan geçiliyor, seed testlerindeki desenle aynı.
    const basketId = new URL(page.url()).pathname.split("/").pop()!;
    await admin().from("baskets").update({ phase: "demo" }).eq("id", basketId);
    await page.reload();
    await expect(page.getByText(/Demo|Sunum|takım/i).first()).toBeVisible({ timeout: 20_000 });
  });
});
