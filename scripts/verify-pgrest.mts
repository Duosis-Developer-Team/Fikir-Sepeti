/* eslint-disable @typescript-eslint/no-explicit-any --
 * Doğrulama betiği: shim'in DÖNDÜRDÜĞÜ tipsiz veriyi kasten `any` olarak ele
 * alıyor, çünkü test edilen şey tam olarak o tipsiz yüzeyin çalışma zamanı
 * davranışı. Uygulama kodunda bu kural açık kalmalı. */

/**
 * PostgREST uyumluluk shim'inin canlı doğrulaması.
 *
 * Bu shim 32 route handler'ın ALTINDA duruyor; bozulursa hata tek bir yerde
 * değil, her yerde çıkar. Bu yüzden CI'da ayrı bir adım olarak koşuyor
 * (`npm run verify:db`) ve RLS'in gerçekten uygulandığını da doğruluyor —
 * yani "veri sızmıyor mu" sorusunun cevabı her commit'te tazeleniyor.
 *
 * KENDİ FİXTURE'INI KURAR: seed verisine bağlı değil, kendi tenant'larını
 * yaratıp sonunda siler. Böylece seed değiştiğinde sessizce yanlış sonuç
 * vermiyor. (İlk yazımda seed'e bağlıydı ve seed değişince 8 test sessizce
 * kırmızıya döndü — bağımlılık kaldırıldı.)
 *
 * ADMIN_DATABASE_URL → kurulum (tablo sahibi, RLS atlanır)
 * DATABASE_URL       → doğrulama (fikirsepeti_app, RLS devrede)
 */
import { Pool, type PoolClient } from "pg";
import { makeDb } from "../lib/server/pgrest";

const adminUrl = process.env.ADMIN_DATABASE_URL;
const appUrl = process.env.DATABASE_URL;
if (!adminUrl || !appUrl) {
  console.error("ADMIN_DATABASE_URL (sahip) ve DATABASE_URL (uygulama rolü) gerekli.");
  process.exit(1);
}

const T_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const T_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const USER_A = "verify.a@verify-a.test";
const USER_B = "verify.b@verify-b.test";

const adminPool = new Pool({ connectionString: adminUrl, max: 3 });
const appPool = new Pool({ connectionString: appUrl, max: 3 });

const admin = makeDb(async (fn) => {
  const c = await adminPool.connect();
  try {
    return await fn(c);
  } finally {
    c.release();
  }
});

function asUser(email: string | null) {
  return makeDb(async <R,>(fn: (c: PoolClient) => Promise<R>) => {
    const c = await appPool.connect();
    try {
      await c.query("begin");
      if (email) await c.query("select set_config('app.user_email', $1, true)", [email]);
      const out = await fn(c);
      await c.query("commit");
      return out;
    } catch (e) {
      await c.query("rollback").catch(() => {});
      throw e;
    } finally {
      c.release();
    }
  });
}

let pass = 0;
let fail = 0;
const t = (name: string, ok: boolean, extra = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${extra ? "  " + extra : ""}`);
};

async function setup() {
  await teardown();
  await admin.from("tenants").insert([
    { id: T_A, name: "Verify A", email_domain: "verify-a.test" },
    { id: T_B, name: "Verify B", email_domain: "verify-b.test" },
  ]);
  await admin.from("tenant_domains").insert([
    { tenant_id: T_A, domain: "verify-a.test" },
    { tenant_id: T_B, domain: "verify-b.test" },
  ]);
  await admin.from("app_users").insert([
    { tenant_id: T_A, user_id: USER_A, email: USER_A, display_name: "A" },
    { tenant_id: T_B, user_id: USER_B, email: USER_B, display_name: "B" },
  ]);
  const { data: memberRole } = await admin
    .from("roles")
    .select("id")
    .eq("key", "member")
    .is("tenant_id", null)
    .single();
  await admin.from("user_roles").insert([
    { tenant_id: T_A, user_id: USER_A, role_id: memberRole.id },
    { tenant_id: T_B, user_id: USER_B, role_id: memberRole.id },
  ]);
  await admin.from("baskets").insert([
    { title: "A sepeti", type: "etkinlik", tenant_id: T_A, created_by: USER_A },
    { title: "B sepeti", type: "etkinlik", tenant_id: T_B, created_by: USER_B },
  ]);
}

async function teardown() {
  // tenants → cascade ile alt tablolar da gider.
  await admin.from("tenants").delete().in("id", [T_A, T_B]);
}

async function main() {
  await setup();
  const sb = asUser(USER_A);

  const a = await sb.from("baskets").select("*").eq("tenant_id", T_A).order("created_at", { ascending: false });
  t("select+eq+order", !a.error && (a.data as any[]).length === 1, `${(a.data as any[])?.length} satır`);

  const b = await sb.from("baskets").select("*").eq("tenant_id", T_B);
  t("RLS: çapraz tenant boş", !b.error && (b.data as any[]).length === 0);

  const c = await asUser(null).from("baskets").select("*");
  t("RLS: kimliksiz boş", !c.error && (c.data as any[]).length === 0);

  const missing = "00000000-0000-4000-8000-000000000000";
  const d = await sb.from("baskets").select("*").eq("id", missing).maybeSingle();
  t("maybeSingle → null", !d.error && d.data === null);

  const e = await sb.from("baskets").select("*").eq("id", missing).single();
  t("single → PGRST116", e.error?.code === "PGRST116");

  const f = await sb
    .from("baskets")
    .insert({ title: "Kurucu testi", type: "etkinlik", tenant_id: T_A, created_by: USER_A })
    .select()
    .single();
  t("insert+select+single", !f.error && (f.data as any)?.title === "Kurucu testi");
  const bid = (f.data as any)?.id;

  const g = await sb.from("baskets").update({ title: "Güncellendi" }).eq("id", bid).select().single();
  t("update+returning", !g.error && (g.data as any)?.title === "Güncellendi");

  const h = await sb.from("baskets").select("id,title").in("id", [bid]);
  t("in()", !h.error && (h.data as any[]).length === 1);

  const h2 = await sb.from("baskets").select("id").in("id", []);
  t("in() boş dizi → 0 satır", !h2.error && (h2.data as any[]).length === 0);

  const i = await sb.from("roles").select("id,key").is("tenant_id", null).eq("key", "organizer");
  t("is(null)", !i.error && (i.data as any[]).length === 1);

  const j = await sb.from("roles").select("id,key,tenant_id").or(`tenant_id.is.null,tenant_id.eq.${T_A}`);
  t("or(is.null,eq)", !j.error && (j.data as any[]).length >= 7, `${(j.data as any[])?.length} rol`);

  const k = await sb.from("app_users").select("email").ilike("email", USER_A.toUpperCase());
  t("ilike", !k.error && (k.data as any[]).length === 1);

  const l = await sb.from("app_users").select("*", { count: "exact", head: true }).eq("tenant_id", T_A);
  t("count exact head", !l.error && l.count === 1, `count=${l.count}`);

  const up = (name: string) =>
    sb
      .from("hackathon_participants")
      .upsert(
        {
          basket_id: bid,
          tenant_id: T_A,
          user_id: USER_A,
          email: USER_A,
          display_name: name,
          role: "admin",
          approved: true,
        },
        { onConflict: "basket_id,user_id" }
      )
      .select()
      .single();
  await up("İlk");
  const u2 = await up("İkinci");
  t("upsert onConflict günceller", !u2.error && (u2.data as any)?.display_name === "İkinci");

  const r = await sb.rpc("resolve_tenant_for_claims", { p_email: USER_A, p_azure_tid: null });
  t("rpc skaler", !r.error && r.data === T_A);

  const r2 = await sb.rpc("peek_tenant_for_email", { p_email: USER_A });
  t("rpc tablo", !r2.error && Array.isArray(r2.data) && (r2.data as any[])[0]?.via === "domain");

  await sb.from("squad_members").insert({ basket_id: bid, member: USER_A, tenant_id: T_A });
  const dup = await sb.from("squad_members").insert({ basket_id: bid, member: USER_A, tenant_id: T_A });
  t("unique violation → 23505", dup.error?.code === "23505", dup.error?.code ?? "");

  const denied = await sb.from("tenant_domains").insert({ tenant_id: T_A, domain: "yeni.example" });
  t("RLS reddi → 42501", denied.error?.code === "42501", denied.error?.code ?? "");

  const crossWrite = await sb
    .from("baskets")
    .insert({ title: "sızıntı", type: "etkinlik", tenant_id: T_B, created_by: USER_A });
  t("çapraz tenant yazma engelli", crossWrite.error?.code === "42501");

  const del = await sb.from("baskets").delete().eq("id", bid);
  t("delete", !del.error);

  const bad = await sb.from("roles").select("*").or("tenant_id.gt.5");
  t("or() desteklenmeyen → hata", Boolean(bad.error));

  await teardown();
  console.log(`\n${pass} geçti, ${fail} kaldı`);
  await adminPool.end();
  await appPool.end();
  process.exit(fail ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await teardown().catch(() => {});
  await adminPool.end().catch(() => {});
  await appPool.end().catch(() => {});
  process.exit(1);
});
