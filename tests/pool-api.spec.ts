import { test, expect } from "@playwright/test";
import { DUOSIS_TENANT_ID } from "../lib/tenant";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

function headers(email: string, tenantId = DUOSIS_TENANT_ID) {
  return {
    "Content-Type": "application/json",
    "X-Dev-User": JSON.stringify({ email, tenantId }),
  };
}

test.describe("S4 Pool API", () => {
  test("member → pool.promote = 403", async ({ request }) => {
    const create = await request.post(`${BASE}/api/pool`, {
      headers: headers("member@duosis.dev"),
      data: { text: "Member pool idea for promote deny" },
    });
    expect(create.status()).toBe(200);
    const { idea } = await create.json();

    const promote = await request.post(`${BASE}/api/pool/promote`, {
      headers: headers("member@duosis.dev"),
      data: {
        pool_idea_ids: [idea.id],
        type: "hackathon",
        title: "Should fail",
      },
    });
    expect(promote.status()).toBe(403);
    const body = await promote.json();
    expect(body.permission).toBe("pool.promote");
  });

  test("organizer → pool.promote = 200 with repo config", async ({ request }) => {
    const create = await request.post(`${BASE}/api/pool`, {
      headers: headers("admin@duosis.dev"),
      data: { text: "Promote me to hackathon", category: "ürün" },
    });
    expect(create.status()).toBe(200);
    const { idea } = await create.json();

    const promote = await request.post(`${BASE}/api/pool/promote`, {
      headers: headers("admin@duosis.dev"),
      data: {
        pool_idea_ids: [idea.id],
        type: "hackathon",
        title: "From jar",
      },
    });
    expect(promote.status()).toBe(200);
    const body = await promote.json();
    expect(body.basketId).toBeTruthy();
    expect(body.basket?.config?.ideaSource).toBe("repo");
    expect(body.basket?.config?.repoPoolIdeaId).toBe(idea.id);
  });

  test("return losing idea to pool", async ({ request }) => {
    const create = await request.post(`${BASE}/api/pool`, {
      headers: headers("admin@duosis.dev"),
      data: { text: "Return-flow primary" },
    });
    const { idea: poolIdea } = await create.json();

    const promote = await request.post(`${BASE}/api/pool/promote`, {
      headers: headers("admin@duosis.dev"),
      data: {
        pool_idea_ids: [poolIdea.id],
        type: "etkinlik",
        title: "Return flow etkinlik",
      },
    });
    const { basketId } = await promote.json();

    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { data: extra } = await sb
      .from("ideas")
      .insert({
        basket_id: basketId,
        text: "Losing idea to jar",
        created_by: "admin@duosis.dev",
        tenant_id: DUOSIS_TENANT_ID,
      })
      .select()
      .single();

    const { data: ideas } = await sb.from("ideas").select("id").eq("basket_id", basketId);
    const winnerId = ideas?.find((i) => i.id !== extra!.id)?.id ?? ideas?.[0]?.id;
    await sb
      .from("baskets")
      .update({ status: "resolved", phase: "resolved", winner_idea_id: winnerId })
      .eq("id", basketId);

    const ret = await request.post(`${BASE}/api/pool/return`, {
      headers: headers("admin@duosis.dev"),
      data: { idea_id: extra!.id, basket_id: basketId },
    });
    expect(ret.status()).toBe(200);
    const { idea: back } = await ret.json();
    expect(back.source_basket_id).toBe(basketId);
    expect(back.text).toBe("Losing idea to jar");
  });
});
