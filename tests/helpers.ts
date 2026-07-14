import { expect, type Page } from "@playwright/test";

const DEV_KEY = "fikirsepeti:devuser";

export const SEED = {
  adminEmail: "admin@duosis.dev",
  adminName: "Admin",
  etkinlikId: "11111111-1111-4111-8111-111111111111",
  hackathonId: "22222222-2222-4222-8222-222222222222",
};

/** Auth bypass login via localStorage before first navigation paints. */
export async function loginAs(
  page: Page,
  user: { email: string; name?: string } = {
    email: SEED.adminEmail,
    name: SEED.adminName,
  }
) {
  await page.addInitScript(
    ({ key, u }) => {
      window.localStorage.setItem(key, JSON.stringify(u));
    },
    {
      key: DEV_KEY,
      u: { id: user.email, email: user.email, name: user.name ?? user.email },
    }
  );
}

export async function expectHome(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Yeni sepet|Yeni/i }).first()).toBeVisible();
}

export async function openNewBasketModal(page: Page) {
  await page.getByRole("button", { name: /Yeni sepet|\+ Yeni/i }).first().click();
  await expect(page.getByRole("heading", { name: "Yeni sepet" })).toBeVisible();
}
