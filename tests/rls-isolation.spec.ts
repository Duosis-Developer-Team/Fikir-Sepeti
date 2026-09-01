import { test, expect } from "@playwright/test";
import { DUOSIS_TENANT_ID, OTHER_TENANT_ID } from "../lib/tenant";
import { asUser, serviceClient } from "./db";

/**
 * S3 GÜVENLİK KAPISI — tenant izolasyonu.
 *
 * Supabase kalktı ama kapının SORUSU aynı: uygulamanın kullandığı yoldan,
 * bir tenant'ın kullanıcısı başka bir tenant'ın tek bir satırını bile
 * görebiliyor mu?
 *
 * Değişen şey saldırı yüzeyi. Eskiden herkesin elinde public anon key vardı
 * ve tarayıcıdan doğrudan veritabanına gidilebiliyordu; test de o yolu
 * taklit ediyordu. Artık veritabanına yalnızca sunucu bağlanıyor — ama
 * izolasyon hâlâ RLS'te, uygulama koduna taşınmadı. Bu yüzden test de
 * uygulamanın bağlandığı ROL ile (fikirsepeti_app) ve kimliği aynı yoldan
 * (`SET LOCAL app.user_email`) vererek koşuyor: kanıtlanan şey, gerçekte
 * çalışan yolun kendisi.
 */
test.describe("S3 RLS isolation (security gate)", () => {
  test("kimliksiz bağlantı hiçbir sepeti okuyamaz", async () => {
    const sb = asUser(null);
    const { data, error } = await sb.from("baskets").select("id, title");
    // Varsayılan "her şeyi gör" değil, HİÇBİR ŞEY: politikalar eşleşmiyor.
    expect(error || (data ?? []).length === 0).toBeTruthy();
    expect((data ?? []).length).toBe(0);
  });

  test("DuoSis kullanıcısı Other Corp satırlarını okuyamaz", async () => {
    const sb = asUser("admin@duosis.dev");

    const { data: baskets } = await sb.from("baskets").select("id, title, tenant_id");
    expect((baskets ?? []).length).toBeGreaterThan(0);
    expect((baskets ?? []).every((b) => b.tenant_id === DUOSIS_TENANT_ID)).toBe(true);
    expect((baskets ?? []).some((b) => b.tenant_id === OTHER_TENANT_ID)).toBe(false);

    // Doğrudan id ile de gelmiyor — filtre atlanarak da erişilemiyor.
    const { data: foreign } = await sb
      .from("baskets")
      .select("id")
      .eq("id", "55555555-5555-4555-8555-555555555555");
    expect(foreign ?? []).toHaveLength(0);
  });

  test("çapraz tenant YAZMA engelleniyor", async () => {
    const sb = asUser("admin@duosis.dev");
    const { error } = await sb.from("baskets").insert({
      title: "sızıntı denemesi",
      type: "etkinlik",
      tenant_id: OTHER_TENANT_ID,
      created_by: "admin@duosis.dev",
    });
    // 42501 = insufficient_privilege → RLS with-check reddi.
    expect(error?.code).toBe("42501");
  });

  test("vote.view_all olmayan üye başkasının oyunu göremez", async () => {
    const admin = serviceClient();
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

    const member = asUser("member@duosis.dev");
    const { data: rows } = await member
      .from("votes")
      .select("voter, idea_id")
      .eq("basket_id", basketId);

    expect((rows ?? []).some((r) => r.voter === "admin@duosis.dev")).toBe(false);
  });

  test("kendi oyunu list_my_votes ile görebiliyor", async () => {
    const member = asUser("member@duosis.dev");
    const basketId = "11111111-1111-4111-8111-111111111111";
    const ideaId = "33333333-3333-4333-8333-333333333333";

    await member.from("votes").delete().eq("basket_id", basketId).eq("voter", "member@duosis.dev");
    const { error: insErr } = await member.from("votes").insert({
      idea_id: ideaId,
      basket_id: basketId,
      phase: "ideas",
      voter: "member@duosis.dev",
      tenant_id: DUOSIS_TENANT_ID,
    });
    expect(insErr).toBeNull();

    // Oy sahipleri gizli ama kişi KENDİ oyunu görmeli — bu ayrım S3'te
    // kuruldu ve uygulamanın "✓ oyun" göstergesi buna bağlı.
    const { data } = await member.rpc("list_my_votes", { p_basket: basketId });
    expect((data as { idea_id: string }[]).some((v) => v.idea_id === ideaId)).toBe(true);
  });

  test("kimliğini başkası gibi gösteremez: voter alanı zorlanıyor", async () => {
    const member = asUser("member@duosis.dev");
    const { error } = await member.from("votes").insert({
      idea_id: "33333333-3333-4333-8333-333333333333",
      basket_id: "11111111-1111-4111-8111-111111111111",
      phase: "finalists",
      voter: "admin@duosis.dev", // başkasının adına
      tenant_id: DUOSIS_TENANT_ID,
    });
    expect(error?.code).toBe("42501");
  });
});
