import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loginAs, SEED } from "./helpers";
import { DUOSIS_TENANT_ID } from "../lib/tenant";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

test.describe("S6 signature raffle", () => {
  test("pool random draw opens raffle stage; skip commits winner", async ({ page }) => {
    const sb = admin();
    const { data: basket, error } = await sb
      .from("baskets")
      .insert({
        title: "S6 Raffle Test",
        type: "hackathon",
        resolve_method: "vote",
        phase: "idea",
        status: "active",
        config: {
          ideaSource: "pool",
          poolSelect: "random",
          teamMode: "solo",
          ideaCount: 1,
          ideaAssignment: "same",
          revealAnimation: true,
          duration: { value: 1, unit: "day" },
        },
        created_by: SEED.adminEmail,
        tenant_id: DUOSIS_TENANT_ID,
      })
      .select()
      .single();
    expect(error).toBeNull();
    const basketId = basket!.id as string;

    await sb.from("hackathon_participants").insert({
      basket_id: basketId,
      user_id: SEED.adminEmail,
      email: SEED.adminEmail,
      display_name: "Admin",
      role: "admin",
      tenant_id: DUOSIS_TENANT_ID,
    });

    for (const text of ["Alpha Idea", "Beta Idea", "Gamma Idea"]) {
      await sb.from("ideas").insert({
        basket_id: basketId,
        text,
        created_by: SEED.adminEmail,
        vote_count: 0,
        tenant_id: DUOSIS_TENANT_ID,
      });
    }

    await loginAs(page);
    await page.goto(`/basket/${basketId}`);
    await expect(page.getByRole("button", { name: /Kura çek/i })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /Kura çek/i }).click();
    await expect(page.getByTestId("raffle-stage")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("raffle-skip").click();
    await expect(page.getByTestId("raffle-stage")).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByText(/Sıra takımlarda/i)).toBeVisible({ timeout: 10_000 });
  });

  test("cross assign stamps team idea_id; result shows mapping", async ({ page }) => {
    const sb = admin();
    const { data: basket } = await sb
      .from("baskets")
      .insert({
        title: "S6 Cross Test",
        type: "hackathon",
        resolve_method: "vote",
        phase: "done",
        status: "resolved",
        config: {
          ideaSource: "pool",
          poolSelect: "random",
          teamMode: "groups",
          groups: { count: 3, size: 1, assignment: "random" },
          ideaCount: 3,
          ideaAssignment: "cross",
          revealAnimation: false,
        },
        created_by: SEED.adminEmail,
        tenant_id: DUOSIS_TENANT_ID,
      })
      .select()
      .single();
    const basketId = basket!.id as string;

    const ideaRows = [];
    for (const text of ["Idea One", "Idea Two", "Idea Three"]) {
      const { data: idea } = await sb
        .from("ideas")
        .insert({
          basket_id: basketId,
          text,
          created_by: SEED.adminEmail,
          vote_count: 0,
          tenant_id: DUOSIS_TENANT_ID,
        })
        .select()
        .single();
      ideaRows.push(idea!);
    }

    await sb
      .from("baskets")
      .update({
        selected_idea_id: ideaRows[0].id,
        winner_idea_id: ideaRows[0].id,
        config: {
          ideaSource: "pool",
          poolSelect: "random",
          teamMode: "groups",
          groups: { count: 3, size: 1, assignment: "random" },
          ideaCount: 3,
          ideaAssignment: "cross",
          revealAnimation: false,
          lockedIdeaIds: ideaRows.map((i) => i.id),
        },
      })
      .eq("id", basketId);

    const teamIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const { data: t } = await sb
        .from("teams")
        .insert({
          basket_id: basketId,
          name: `Squad ${i + 1}`,
          tenant_id: DUOSIS_TENANT_ID,
          idea_id: ideaRows[i].id,
        })
        .select()
        .single();
      teamIds.push(t!.id);
      await sb.from("team_members").insert({
        team_id: t!.id,
        basket_id: basketId,
        user_id: SEED.adminEmail,
        tenant_id: DUOSIS_TENANT_ID,
      });
    }

    await sb.from("hackathon_participants").insert({
      basket_id: basketId,
      user_id: SEED.adminEmail,
      email: SEED.adminEmail,
      display_name: "Admin",
      role: "admin",
      tenant_id: DUOSIS_TENANT_ID,
    });

    await loginAs(page);
    await page.goto(`/basket/${basketId}/result`);
    await expect(page.getByTestId("result-page")).toBeVisible();
    const labels = page.getByTestId("result-team-idea");
    await expect(labels).toHaveCount(3);
    await expect(page.getByText(/Fikir: Idea One/)).toBeVisible();
    await expect(page.getByText(/Fikir: Idea Two/)).toBeVisible();
    await expect(page.getByText(/Fikir: Idea Three/)).toBeVisible();
  });

  test("revealAnimation false skips stage for random draw", async ({ page }) => {
    const sb = admin();
    const { data: basket } = await sb
      .from("baskets")
      .insert({
        title: "S6 No Anim",
        type: "hackathon",
        resolve_method: "vote",
        phase: "idea",
        status: "active",
        config: {
          ideaSource: "pool",
          poolSelect: "random",
          teamMode: "solo",
          revealAnimation: false,
        },
        created_by: SEED.adminEmail,
        tenant_id: DUOSIS_TENANT_ID,
      })
      .select()
      .single();
    const basketId = basket!.id as string;
    await sb.from("hackathon_participants").insert({
      basket_id: basketId,
      user_id: SEED.adminEmail,
      email: SEED.adminEmail,
      display_name: "Admin",
      role: "admin",
      tenant_id: DUOSIS_TENANT_ID,
    });
    await sb.from("ideas").insert([
      {
        basket_id: basketId,
        text: "NoAnim A",
        created_by: SEED.adminEmail,
        vote_count: 0,
        tenant_id: DUOSIS_TENANT_ID,
      },
      {
        basket_id: basketId,
        text: "NoAnim B",
        created_by: SEED.adminEmail,
        vote_count: 0,
        tenant_id: DUOSIS_TENANT_ID,
      },
    ]);

    await loginAs(page);
    await page.goto(`/basket/${basketId}`);
    await page.getByRole("button", { name: /Kura çek/i }).click();
    await expect(page.getByTestId("raffle-stage")).toHaveCount(0);
    await expect(page.getByText(/Sıra takımlarda/i)).toBeVisible({ timeout: 10_000 });
  });
});
