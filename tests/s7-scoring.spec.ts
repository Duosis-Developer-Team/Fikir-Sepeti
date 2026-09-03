import { test, expect } from "@playwright/test";
import { loginAs, SEED } from "./helpers";
import { DUOSIS_TENANT_ID } from "../lib/tenant";
import { DEFAULT_RUBRIC } from "../lib/scoring";
import { serviceClient } from "./db";

function admin() {
  return serviceClient();
}

test.describe("S7 rubric scoring", () => {
  test("rubric demo shows scoreboard category breakdown", async ({ page }) => {
    const sb = admin();
    const { data: basket } = await sb
      .from("baskets")
      .insert({
        title: "S7 Rubric Demo",
        type: "hackathon",
        resolve_method: "vote",
        phase: "demo",
        status: "active",
        config: {
          ideaSource: "static",
          teamMode: "solo",
          scoringMode: "rubric",
          rubric: DEFAULT_RUBRIC,
          juryEnabled: true,
          juryWeight: 2,
          duration: { value: 1, unit: "day" },
        },
        created_by: SEED.adminEmail,
        tenant_id: DUOSIS_TENANT_ID,
      })
      .select()
      .single();
    const basketId = basket!.id as string;

    const { data: idea } = await sb
      .from("ideas")
      .insert({
        basket_id: basketId,
        text: "Rubric Idea",
        created_by: SEED.adminEmail,
        vote_count: 0,
        tenant_id: DUOSIS_TENANT_ID,
      })
      .select()
      .single();

    await sb.from("baskets").update({ selected_idea_id: idea!.id }).eq("id", basketId);

    const { data: team } = await sb
      .from("teams")
      .insert({
        basket_id: basketId,
        name: "Alpha",
        tenant_id: DUOSIS_TENANT_ID,
        idea_id: idea!.id,
      })
      .select()
      .single();

    await sb.from("team_members").insert({
      team_id: team!.id,
      basket_id: basketId,
      user_id: SEED.adminEmail,
      tenant_id: DUOSIS_TENANT_ID,
    });

    await sb.from("hackathon_participants").insert({
      basket_id: basketId,
      user_id: SEED.adminEmail,
      email: SEED.adminEmail,
      display_name: "Admin",
      role: "admin",
      tenant_id: DUOSIS_TENANT_ID,
    });

    // Rubrik puanlama artik sadece jury izni olanlara acik (0026_jury_only_scoring.sql) —
    // tenant_admin/platform_owner bunu artik otomatik tasimiyor, bu sepete ozel ata.
    await sb.from("user_roles").insert({
      tenant_id: DUOSIS_TENANT_ID,
      user_id: SEED.adminEmail,
      role_id: "c0000000-0000-4000-8000-000000000005", // jury (bkz. 0004_rbac.sql)
      scope_basket_id: basketId,
    });

    // Seed one category score so scoreboard shows breakdown immediately
    await sb.from("scores").insert({
      basket_id: basketId,
      tenant_id: DUOSIS_TENANT_ID,
      team_id: team!.id,
      voter: SEED.memberEmail,
      category_key: "ui",
      stars: 5,
      is_jury: false,
    });
    await sb.from("scores").insert({
      basket_id: basketId,
      tenant_id: DUOSIS_TENANT_ID,
      team_id: team!.id,
      voter: "jury@duosis.dev",
      category_key: "ui",
      stars: 3,
      is_jury: true,
    });

    await loginAs(page);
    await page.goto(`/basket/${basketId}`);
    await expect(page.getByTestId("rubric-score-panel")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("scoreboard")).toBeVisible();
    await expect(page.getByTestId("scoreboard-breakdown").locator("[data-category=ui]")).toBeVisible();

    await page.getByLabel(/Arayüz 4 yıldız/i).click();
    await expect(page.getByTestId("stars-ui")).toBeVisible();
  });

  test("scoringMode simple keeps team vote UI", async ({ page }) => {
    const sb = admin();
    const { data: basket } = await sb
      .from("baskets")
      .insert({
        title: "S7 Simple Demo",
        type: "hackathon",
        resolve_method: "vote",
        phase: "demo",
        status: "active",
        config: {
          ideaSource: "static",
          teamMode: "solo",
          scoringMode: "simple",
        },
        created_by: SEED.adminEmail,
        tenant_id: DUOSIS_TENANT_ID,
      })
      .select()
      .single();
    const basketId = basket!.id as string;

    const { data: idea } = await sb
      .from("ideas")
      .insert({
        basket_id: basketId,
        text: "Simple Idea",
        created_by: SEED.adminEmail,
        vote_count: 0,
        tenant_id: DUOSIS_TENANT_ID,
      })
      .select()
      .single();
    await sb.from("baskets").update({ selected_idea_id: idea!.id }).eq("id", basketId);

    const { data: team } = await sb
      .from("teams")
      .insert({ basket_id: basketId, name: "Solo", tenant_id: DUOSIS_TENANT_ID })
      .select()
      .single();
    await sb.from("team_members").insert({
      team_id: team!.id,
      basket_id: basketId,
      user_id: SEED.adminEmail,
      tenant_id: DUOSIS_TENANT_ID,
    });
    await sb.from("hackathon_participants").insert({
      basket_id: basketId,
      user_id: SEED.adminEmail,
      email: SEED.adminEmail,
      display_name: "Admin",
      role: "admin",
      tenant_id: DUOSIS_TENANT_ID,
    });

    await loginAs(page);
    await page.goto(`/basket/${basketId}`);
    await expect(page.getByText(/En iyi yapımı/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("rubric-score-panel")).toHaveCount(0);
    await expect(page.getByText(/oyunu ver/i).first()).toBeVisible();
  });
});
