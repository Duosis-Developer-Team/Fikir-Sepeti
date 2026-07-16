import { test, expect } from "@playwright/test";
import { loginAs, SEED } from "./helpers";
import { DUOSIS_TENANT_ID } from "../lib/tenant";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const HACK = SEED.hackathonId;

function headers(email: string, tenantId = DUOSIS_TENANT_ID) {
  return {
    "Content-Type": "application/json",
    "X-Dev-User": JSON.stringify({ email, tenantId }),
  };
}

test.describe("S11 Lobby", () => {
  test("approval policy: member joins pending; admin approves", async ({
    request,
  }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Ensure seed hackathon is in lobby with approval
    await sb
      .from("baskets")
      .update({
        phase: "lobby",
        lobby_locked: false,
        status: "active",
        config: { lobbyPolicy: "approval", ideaSource: "static" },
      })
      .eq("id", HACK);

    await sb
      .from("hackathon_participants")
      .delete()
      .eq("basket_id", HACK)
      .eq("user_id", "member@duosis.dev");

    const join = await request.post(`${BASE}/api/lobby/join`, {
      headers: headers("member@duosis.dev"),
      data: { basket_id: HACK, display_name: "Member" },
    });
    expect(join.status()).toBe(200);
    const j = await join.json();
    expect(j.approved).toBe(false);

    const approve = await request.patch(`${BASE}/api/lobby/join`, {
      headers: headers("admin@duosis.dev"),
      data: {
        basket_id: HACK,
        action: "approve",
        user_id: "member@duosis.dev",
      },
    });
    expect(approve.status()).toBe(200);

    const { data: part } = await sb
      .from("hackathon_participants")
      .select("approved")
      .eq("basket_id", HACK)
      .eq("user_id", "member@duosis.dev")
      .maybeSingle();
    expect(part?.approved).toBe(true);
  });

  test("started basket without late join → 403", async ({ request }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const lockedId = "bbbb9999-9999-4999-8999-999999999991";
    await sb.from("hackathon_participants").delete().eq("basket_id", lockedId);
    await sb.from("baskets").delete().eq("id", lockedId);
    await sb.from("baskets").insert({
      id: lockedId,
      title: "S11 locked lobby",
      type: "hackathon",
      resolve_method: "vote",
      phase: "idea",
      status: "active",
      lobby_locked: true,
      config: { allowLateJoin: false },
      created_by: "admin@duosis.dev",
      tenant_id: DUOSIS_TENANT_ID,
    });

    const join = await request.post(`${BASE}/api/lobby/join`, {
      headers: headers("member@duosis.dev"),
      data: { basket_id: lockedId },
    });
    expect(join.status()).toBe(403);

    // late join on
    await sb
      .from("baskets")
      .update({ config: { allowLateJoin: true }, lobby_locked: true })
      .eq("id", lockedId);
    const late = await request.post(`${BASE}/api/lobby/join`, {
      headers: headers("member@duosis.dev"),
      data: { basket_id: lockedId },
    });
    expect(late.status()).toBe(200);
  });

  test("etkinlik shows invite panel for owner", async ({ page }) => {
    await loginAs(page);
    await page.goto(`/basket/${SEED.etkinlikId}`);
    await expect(page.getByTestId("invite-panel")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("invite-whatsapp")).toBeVisible();
  });
});
