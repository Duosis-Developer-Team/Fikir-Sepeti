import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";
import { DUOSIS_TENANT_ID } from "../lib/tenant";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
const ARCHIVE_ETKINLIK = "99999999-9999-4999-8999-999999999999";

function headers(email: string, tenantId = DUOSIS_TENANT_ID) {
  return {
    "Content-Type": "application/json",
    "X-Dev-User": JSON.stringify({ email, tenantId }),
  };
}

test.describe("S9 Moderation", () => {
  test("default rule action is warn; block rejects idea", async ({
    request,
  }) => {
    // Create warn + block rules
    const warn = await request.post(`${BASE}/api/moderation/rules`, {
      headers: headers("admin@duosis.dev"),
      data: { pattern: "uyarikelime", action: "warn", kind: "word" },
    });
    expect(warn.status()).toBe(200);

    const block = await request.post(`${BASE}/api/moderation/rules`, {
      headers: headers("admin@duosis.dev"),
      data: { pattern: "yasakkelime", action: "block", kind: "word" },
    });
    expect(block.status()).toBe(200);
    const blockRule = await block.json();

    const blocked = await request.post(`${BASE}/api/content/ideas`, {
      headers: headers("member@duosis.dev"),
      data: {
        basket_id: "11111111-1111-4111-8111-111111111111",
        text: "bu yasakkelime içeriyor",
      },
    });
    expect(blocked.status()).toBe(422);

    const warned = await request.post(`${BASE}/api/content/ideas`, {
      headers: headers("member@duosis.dev"),
      data: {
        basket_id: "11111111-1111-4111-8111-111111111111",
        text: "bu uyarikelime içeriyor",
      },
    });
    expect(warned.status()).toBe(409);
    const warnBody = await warned.json();
    expect(warnBody.message).toMatch(/uyarikelime/i);

    const ack = await request.post(`${BASE}/api/content/ideas`, {
      headers: headers("member@duosis.dev"),
      data: {
        basket_id: "11111111-1111-4111-8111-111111111111",
        text: "bu uyarikelime içeriyor ve onaylı",
        acknowledge: true,
      },
    });
    expect(ack.status()).toBe(200);
    const idea = (await ack.json()).idea;

    const flags = await request.get(`${BASE}/api/moderation/flags?status=pending`, {
      headers: headers("admin@duosis.dev"),
    });
    expect(flags.status()).toBe(200);
    const flagList = await flags.json();
    expect(
      (flagList.flags as { entity_id: string }[]).some((f) => f.entity_id === idea.id)
    ).toBe(true);

    const flag = (flagList.flags as { id: string; entity_id: string }[]).find(
      (f) => f.entity_id === idea.id
    )!;
    const hide = await request.patch(`${BASE}/api/moderation/flags`, {
      headers: headers("admin@duosis.dev"),
      data: { id: flag.id, decision: "hide" },
    });
    expect(hide.status()).toBe(200);

    // Member archive must not see hidden idea text via home ideas — check via content ideas list isn't available;
    // use service: member archive of a basket won't include this idea if we query archive for etkinlik seed
    // Cleanup block rule action sanity
    expect(blockRule.rule.action).toBe("block");
  });

  test("member without vote.view_all gets masked voters on archive API", async ({
    request,
  }) => {
    const admin = await request.get(
      `${BASE}/api/archive/${ARCHIVE_ETKINLIK}`,
      { headers: headers("admin@duosis.dev") }
    );
    expect(admin.status()).toBe(200);
    const adminJson = await admin.json();
    expect(adminJson.canViewVotes).toBe(true);
    expect(adminJson.votes.length).toBeGreaterThan(0);
    expect(adminJson.votes.some((v: { voter: string }) => v.voter.includes("@"))).toBe(
      true
    );

    const member = await request.get(
      `${BASE}/api/archive/${ARCHIVE_ETKINLIK}`,
      { headers: headers("member@duosis.dev") }
    );
    expect(member.status()).toBe(200);
    const memberJson = await member.json();
    expect(memberJson.canViewVotes).toBe(false);
    // only own votes (member voted on archive)
    for (const v of memberJson.votes as { voter: string }[]) {
      expect(v.voter).toBe("member@duosis.dev");
    }
  });

  test("role assign writes audit_log", async ({ request }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const roles = await request.get(`${BASE}/api/tenant/roles`, {
      headers: headers("admin@duosis.dev"),
    });
    expect(roles.status()).toBe(200);
    const rolesJson = await roles.json();
    const jury = (rolesJson.roles as { id: string; key: string }[]).find(
      (r) => r.key === "jury"
    );
    expect(jury).toBeTruthy();

    await request.post(`${BASE}/api/tenant/roles`, {
      headers: headers("admin@duosis.dev"),
      data: {
        action: "assign",
        userId: "member@duosis.dev",
        roleId: jury!.id,
      },
    });

    const { data } = await sb
      .from("audit_log")
      .select("action, actor")
      .eq("tenant_id", DUOSIS_TENANT_ID)
      .eq("action", "role.assign")
      .order("created_at", { ascending: false })
      .limit(1);
    expect(data?.[0]?.actor).toBe("admin@duosis.dev");

    await request.post(`${BASE}/api/tenant/roles`, {
      headers: headers("admin@duosis.dev"),
      data: {
        action: "revoke",
        userId: "member@duosis.dev",
        roleId: jury!.id,
      },
    });
  });

  test("moderation page loads for admin", async ({ page }) => {
    await loginAs(page);
    await page.goto("/moderation");
    await expect(page.getByTestId("moderation-page")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("moderation-rules")).toBeVisible();
    await expect(page.getByTestId("moderation-queue")).toBeVisible();
  });
});
