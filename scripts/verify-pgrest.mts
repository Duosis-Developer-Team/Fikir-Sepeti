/* eslint-disable @typescript-eslint/no-explicit-any --
 * Doğrulama betiği: shim'in DÖNDÜRDÜĞÜ tipsiz veriyi kasten `any` olarak
 * ele alıyor, çünkü test edilen şey tam olarak o tipsiz yüzeyin çalışma
 * zamanı davranışı. Uygulama kodunda bu kural açık kalmalı. */
/**
 * PostgREST uyumluluk shim'inin canlı doğrulaması.
 *
 * Bu shim 32 route handler'ın ALTINDA duruyor; bozulursa hata tek bir yerde
 * değil, her yerde çıkar. Bu yüzden CI'da ayrı bir adım olarak koşuyor
 * (`npm run verify:db`) ve RLS'in gerçekten uygulandığını da doğruluyor —
 * yani "veri sızmıyor mu" sorusunun cevabı her commit'te tazeleniyor.
 *
 * server-only guard'ı yüzünden react-server koşuluyla çalıştırılmalı;
 * package.json'daki script bunu veriyor.
 */
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL gerekli (uygulama rolüyle: fikirsepeti_app).");
  process.exit(1);
}
const { dbForIdentity } = await import("../lib/server/pgrest");
const DUO = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const sb = dbForIdentity("ali@duosis.dev");
const anon = dbForIdentity(null);
let pass = 0, fail = 0;
const t = (name: string, ok: boolean, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "✓" : "✗"} ${name}${extra ? "  " + extra : ""}`); };

// select + eq + order
const a = await sb.from("baskets").select("*").eq("tenant_id", DUO).order("created_at", { ascending: false });
t("select+eq+order", !a.error && Array.isArray(a.data) && (a.data as any[]).length > 0, `${(a.data as any[])?.length} satır`);

// RLS: başka tenant'ı göremez
const b = await sb.from("baskets").select("*").eq("tenant_id", OTHER);
t("RLS: çapraz tenant boş", !b.error && (b.data as any[]).length === 0);

// kimliksiz
const c = await anon.from("baskets").select("*");
t("RLS: kimliksiz boş", !c.error && (c.data as any[]).length === 0);

// maybeSingle yok
const d = await sb.from("baskets").select("*").eq("id", "00000000-0000-4000-8000-000000000000").maybeSingle();
t("maybeSingle → null", !d.error && d.data === null);

// single hata
const e = await sb.from("baskets").select("*").eq("id", "00000000-0000-4000-8000-000000000000").single();
t("single → PGRST116", e.error?.code === "PGRST116");

// insert + select (returning)
const f = await sb.from("baskets").insert({ title: "Kurucu testi", type: "etkinlik", tenant_id: DUO, created_by: "ali@duosis.dev" }).select().single();
t("insert+select+single", !f.error && (f.data as any)?.title === "Kurucu testi");
const bid = (f.data as any)?.id;

// update
const g = await sb.from("baskets").update({ title: "Güncellendi" }).eq("id", bid).select().single();
t("update+returning", !g.error && (g.data as any)?.title === "Güncellendi");

// in()
const h = await sb.from("baskets").select("id,title").in("id", [bid]);
t("in()", !h.error && (h.data as any[]).length === 1);
const h2 = await sb.from("baskets").select("id").in("id", []);
t("in() boş dizi → 0 satır", !h2.error && (h2.data as any[]).length === 0);

// is null
const i = await sb.from("roles").select("id,key").is("tenant_id", null).eq("key", "organizer");
t("is(null)", !i.error && (i.data as any[]).length === 1);

// or()
const j = await sb.from("roles").select("id,key,tenant_id").or(`tenant_id.is.null,tenant_id.eq.${DUO}`);
t("or(is.null,eq)", !j.error && (j.data as any[]).length >= 7, `${(j.data as any[])?.length} rol`);

// ilike
const k = await sb.from("app_users").select("email").ilike("email", "ALI@duosis.dev");
t("ilike", !k.error && (k.data as any[]).length === 1);

// count + head
const l = await sb.from("app_users").select("*", { count: "exact", head: true }).eq("tenant_id", DUO);
t("count exact head", !l.error && l.count === 1, `count=${l.count}`);

// upsert onConflict
const u1 = await sb.from("hackathon_participants").upsert({ basket_id: bid, tenant_id: DUO, user_id: "ali@duosis.dev", email: "ali@duosis.dev", display_name: "Ali", role: "admin", approved: true }, { onConflict: "basket_id,user_id" }).select().single();
const u2 = await sb.from("hackathon_participants").upsert({ basket_id: bid, tenant_id: DUO, user_id: "ali@duosis.dev", email: "ali@duosis.dev", display_name: "Ali 2", role: "admin", approved: true }, { onConflict: "basket_id,user_id" }).select().single();
t("upsert onConflict günceller", !u1.error && !u2.error && (u2.data as any)?.display_name === "Ali 2");

// rpc skaler
const r = await sb.rpc("resolve_tenant_for_claims", { p_email: "ali@duosis.dev", p_azure_tid: null });
t("rpc skaler", !r.error && r.data === DUO);

// rpc tablo dönen
const r2 = await sb.rpc("peek_tenant_for_email", { p_email: "ali@duosis.dev" });
t("rpc tablo", !r2.error && Array.isArray(r2.data) && (r2.data as any[])[0]?.via === "domain");

// hata kodu (unique violation) — ali'nin yazabildiği bir tabloda
await sb.from("squad_members").insert({ basket_id: bid, member: "ali@duosis.dev", tenant_id: DUO });
const dup = await sb.from("squad_members").insert({ basket_id: bid, member: "ali@duosis.dev", tenant_id: DUO });
t("unique violation → 23505", dup.error?.code === "23505", dup.error?.code ?? "");

// RLS reddi ayırt edilebiliyor mu (yetkisiz tabloya yazma)
const denied = await sb.from("tenant_domains").insert({ tenant_id: DUO, domain: "yeni.example" });
t("RLS reddi → 42501", denied.error?.code === "42501", denied.error?.code ?? "");

// delete
const del = await sb.from("baskets").delete().eq("id", bid);
t("delete", !del.error);

// desteklenmeyen operatör açık hata veriyor mu
const bad = await sb.from("roles").select("*").or("tenant_id.gt.5");
t("or() desteklenmeyen → hata", Boolean(bad.error));

console.log(`\n${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
