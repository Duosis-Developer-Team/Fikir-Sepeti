import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import { DUOSIS_TENANT_ID } from "../lib/tenant";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const ARCHIVE_HACK = "aaaa1111-1111-4111-8111-111111111111";
const ARCHIVE_TEAM = "eeee5555-5555-4555-8555-555555555555";

function headers(email: string, tenantId = DUOSIS_TENANT_ID) {
  return {
    "Content-Type": "application/json",
    "X-Dev-User": JSON.stringify({ email, tenantId }),
  };
}

test.describe("S10 project feedback", () => {
  test("result page groups feedback by team", async ({ page }) => {
    await loginAs(page);
    await page.goto(`/basket/${ARCHIVE_HACK}/result`);
    await expect(page.getByTestId("result-feedback")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("result-feedback-grouped")).toBeVisible();
    const group = page.getByTestId(`result-feedback-group-${ARCHIVE_TEAM}`);
    await expect(group).toBeVisible();
    await expect(group.getByText("Harika demo")).toBeVisible();
    // Label is team name when teams loaded, else "Takım"
    await expect(group.locator("h3")).toContainText(/Squad Alpha|Takım/);
  });

  test("feedback API accepts team_id", async ({ request }) => {
    const res = await request.post(`${BASE}/api/content/feedback`, {
      headers: headers("admin@duosis.dev"),
      data: {
        basket_id: ARCHIVE_HACK,
        team_id: ARCHIVE_TEAM,
        text: "S10 team-scoped note",
        author_name: "Admin",
      },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.feedback.team_id).toBe(ARCHIVE_TEAM);
    expect(json.feedback.text).toContain("S10");
  });
});
