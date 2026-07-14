import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { DUOSIS_TENANT_ID, OTHER_TENANT_ID } from "../lib/tenant";
import { DEV_AUTH_PASSWORD } from "../lib/dev-auth";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

test.describe("S3 RLS isolation (security gate)", () => {
  test("anon key alone cannot read baskets", async () => {
    const sb = createClient(url, anon, { auth: { persistSession: false } });
    const { data, error } = await sb.from("baskets").select("id, title");
    // With RLS and no JWT: empty or error — never Other Corp / Duo seed leak
    expect(error || (data ?? []).length === 0).toBeTruthy();
    if (data) {
      expect(data.find((b) => b.title?.includes("Other Corp"))).toBeUndefined();
    }
  });

  test("DuoSis JWT cannot read Other Corp rows (raw anon client)", async () => {
    const sb = createClient(url, anon, { auth: { persistSession: false } });
    const { error: signErr } = await sb.auth.signInWithPassword({
      email: "admin@duosis.dev",
      password: DEV_AUTH_PASSWORD,
    });
    expect(signErr).toBeNull();

    const { data: baskets } = await sb.from("baskets").select("id, title, tenant_id");
    expect((baskets ?? []).every((b) => b.tenant_id === DUOSIS_TENANT_ID)).toBe(true);
    expect((baskets ?? []).some((b) => b.tenant_id === OTHER_TENANT_ID)).toBe(false);
    expect((baskets ?? []).some((b) => (b.title as string)?.includes("Other Corp"))).toBe(false);

    const { data: foreign } = await sb
      .from("baskets")
      .select("id")
      .eq("id", "55555555-5555-4555-8555-555555555555");
    expect(foreign ?? []).toHaveLength(0);
  });

  test("member cannot select other voters from votes", async () => {
    const admin = createClient(url, anon, { auth: { persistSession: false } });
    await admin.auth.signInWithPassword({
      email: "admin@duosis.dev",
      password: DEV_AUTH_PASSWORD,
    });
    // Ensure a vote exists from admin
    const ideaId = "33333333-3333-4333-8333-333333333333";
    const basketId = "11111111-1111-4111-8111-111111111111";
    await admin.from("votes").delete().eq("basket_id", basketId).eq("voter", "admin@duosis.dev");
    await admin.from("votes").insert({
      idea_id: ideaId,
      basket_id: basketId,
      phase: "ideas",
      voter: "admin@duosis.dev",
      tenant_id: DUOSIS_TENANT_ID,
    });

    const member = createClient(url, anon, { auth: { persistSession: false } });
    await member.auth.signInWithPassword({
      email: "member@duosis.dev",
      password: DEV_AUTH_PASSWORD,
    });
    const { data: rows } = await member
      .from("votes")
      .select("voter, idea_id")
      .eq("basket_id", basketId);
    // Member without vote.view_all should not see admin's voter row
    expect((rows ?? []).some((r) => r.voter === "admin@duosis.dev")).toBe(false);
  });

  test("authenticated writes visible via fetch (realtime+polling path)", async () => {
    const sb = createClient(url, anon, { auth: { persistSession: false } });
    await sb.auth.signInWithPassword({
      email: "admin@duosis.dev",
      password: DEV_AUTH_PASSWORD,
    });

    const basketId = "11111111-1111-4111-8111-111111111111";
    const text = `RLS ping ${Date.now()}`;
    const started = Date.now();

    const { error: insErr } = await sb.from("ideas").insert({
      basket_id: basketId,
      tenant_id: DUOSIS_TENANT_ID,
      text,
      created_by: "admin@duosis.dev",
    });
    expect(insErr).toBeNull();

    // useRealtimeVotes falls back to 3s polling when realtime is slow under RLS
    let found = false;
    for (let i = 0; i < 10; i++) {
      const { data } = await sb
        .from("ideas")
        .select("text")
        .eq("basket_id", basketId)
        .eq("text", text);
      if ((data ?? []).length) {
        found = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    const latency = Date.now() - started;
    expect(found).toBe(true);
    expect(latency).toBeLessThan(8_000);
    console.log(`S3 authenticated fetch latency ms=${latency}`);
  });
});
