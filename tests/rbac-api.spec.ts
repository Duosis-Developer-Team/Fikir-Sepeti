import { test, expect } from "@playwright/test";
import { DUOSIS_TENANT_ID } from "../lib/tenant";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";

function headers(email: string, tenantId = DUOSIS_TENANT_ID) {
  return {
    "Content-Type": "application/json",
    "X-Dev-User": JSON.stringify({ email, tenantId }),
  };
}

test.describe("S2 RBAC API", () => {
  test("member → hackathon.create = 403", async ({ request }) => {
    const res = await request.post(`${BASE}/api/baskets`, {
      headers: headers("member@duosis.dev"),
      data: { title: "Member hack attempt", type: "hackathon" },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.permission).toBe("hackathon.create");
  });

  test("organizer → hackathon.create = 200", async ({ request }) => {
    const res = await request.post(`${BASE}/api/baskets`, {
      headers: headers("admin@duosis.dev"),
      data: { title: "Organizer hackathon", type: "hackathon" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.basket?.type).toBe("hackathon");
  });

  test("member → etkinlik.create = 200", async ({ request }) => {
    const res = await request.post(`${BASE}/api/baskets`, {
      headers: headers("member@duosis.dev"),
      data: { title: "Member etkinlik", type: "etkinlik", resolve_method: "vote" },
    });
    expect(res.status()).toBe(200);
  });

  test("basket-scoped jury applies only when scope matches", async ({ request }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    const juryRole = "c0000000-0000-4000-8000-000000000005";
    const basketA = "11111111-1111-4111-8111-111111111111";
    const basketB = "22222222-2222-4222-8222-222222222222";

    await sb.from("user_roles").delete().eq("user_id", "member@duosis.dev").eq("role_id", juryRole);
    await sb.from("user_roles").insert({
      tenant_id: DUOSIS_TENANT_ID,
      user_id: "member@duosis.dev",
      role_id: juryRole,
      scope_basket_id: basketA,
    });

    const onA = await request.get(
      `${BASE}/api/permissions/check?permission=hackathon.jury&basketId=${basketA}`,
      { headers: headers("member@duosis.dev") }
    );
    expect(onA.status()).toBe(200);
    expect((await onA.json()).allowed).toBe(true);

    const onB = await request.get(
      `${BASE}/api/permissions/check?permission=hackathon.jury&basketId=${basketB}`,
      { headers: headers("member@duosis.dev") }
    );
    expect((await onB.json()).allowed).toBe(false);

    const list = await request.get(`${BASE}/api/tenant/roles`, {
      headers: headers("admin@duosis.dev"),
    });
    expect(list.status()).toBe(200);
    const memberList = await request.get(`${BASE}/api/tenant/roles`, {
      headers: headers("member@duosis.dev"),
    });
    expect(memberList.status()).toBe(403);
  });
});
