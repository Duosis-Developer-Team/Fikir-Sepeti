import { test, expect } from "@playwright/test";
import { createAuthUser, serviceClient } from "./db";

/**
 * Şifre sıfırlama akışı — uçtan uca.
 *
 * Bu akışın hiç testi yoktu ve güvenlik açısından hassas: yanlış kurgulanırsa
 * bir e-posta linki hesabı ele geçirmeye yeter. Supabase sürümünde kurtarma
 * linki kullanıcıyı OTURUM AÇTIRIYORDU; burada link yalnızca tek kullanımlık
 * bir jeton taşıyor ve sahibi SADECE yeni şifre belirleyebiliyor.
 *
 * Doğrulananlar:
 *  - jeton e-posta kutusuna yazılıyor (EMAIL_PROVIDER=log_only)
 *  - yeni şifre çalışıyor, eskisi çalışmıyor
 *  - jeton TEK KULLANIMLIK
 *  - sıfırlama eski oturumların hepsini iptal ediyor
 *  - olmayan hesap için uç yine 200 dönüyor (hesap sayımına kapalı)
 */

const OLD = "EskiParola123";
const NEW = "YeniParola456";

async function tokenFor(email: string): Promise<string | null> {
  const { data } = await serviceClient()
    .from("email_outbox")
    .select("body")
    .eq("to_email", email)
    .eq("kind", "reset")
    .order("created_at", { ascending: false })
    .limit(1);
  const body = (data as { body: string }[])?.[0]?.body;
  return body?.match(/reset=([A-Za-z0-9_-]+)/)?.[1] ?? null;
}

test.describe("şifre sıfırlama", () => {
  test("jeton üretiliyor, yeni şifre çalışıyor, eskisi çalışmıyor", async ({ request }) => {
    const email = `reset_${Date.now()}@duosis.dev`;
    await createAuthUser(email, OLD);

    const req = await request.post("/api/auth/password-reset", { data: { email } });
    expect(req.ok()).toBeTruthy();

    const token = await tokenFor(email);
    expect(token, "sıfırlama jetonu email_outbox'a yazılmalı").toBeTruthy();

    const put = await request.put("/api/auth/password-reset", {
      data: { token, password: NEW },
    });
    expect(put.ok()).toBeTruthy();

    const withOld = await request.post("/api/auth/login", {
      data: { email, password: OLD },
    });
    expect(withOld.status(), "eski şifre artık geçersiz olmalı").toBe(401);

    const withNew = await request.post("/api/auth/login", {
      data: { email, password: NEW },
    });
    expect(withNew.ok(), "yeni şifreyle giriş yapılabilmeli").toBeTruthy();
  });

  test("jeton tek kullanımlık", async ({ request }) => {
    const email = `reset_once_${Date.now()}@duosis.dev`;
    await createAuthUser(email, OLD);
    await request.post("/api/auth/password-reset", { data: { email } });
    const token = await tokenFor(email);

    const first = await request.put("/api/auth/password-reset", {
      data: { token, password: NEW },
    });
    expect(first.ok()).toBeTruthy();

    // Aynı link ikinci kez kullanılamaz: e-postası sızan biri, kullanıcı
    // şifresini değiştirdikten sonra o linkle geri dönememeli.
    const second = await request.put("/api/auth/password-reset", {
      data: { token, password: "UcuncuParola789" },
    });
    expect(second.status()).toBe(400);
  });

  test("sıfırlama mevcut oturumları iptal ediyor", async ({ request }) => {
    const email = `reset_sess_${Date.now()}@duosis.dev`;
    await createAuthUser(email, OLD);

    const login = await request.post("/api/auth/login", {
      data: { email, password: OLD },
    });
    expect(login.ok()).toBeTruthy();

    // Oturum çerezi elde; sıfırlamadan ÖNCE geçerli olduğunu doğrula.
    const before = await request.get("/api/auth/session");
    expect(((await before.json()) as { user: unknown }).user).not.toBeNull();

    await request.post("/api/auth/password-reset", { data: { email } });
    const token = await tokenFor(email);
    await request.put("/api/auth/password-reset", { data: { token, password: NEW } });

    // Sıfırlamanın amacı hesabı geri almaksa, saldırganın açık oturumu
    // ayakta kalmamalı.
    const after = await request.get("/api/auth/session");
    expect(((await after.json()) as { user: unknown }).user).toBeNull();
  });

  test("olmayan hesapta da 200 — hesap sayımına kapalı", async ({ request }) => {
    const res = await request.post("/api/auth/password-reset", {
      data: { email: `yok_${Date.now()}@duosis.dev` },
    });
    // Cevabın farklı olması, bir e-postanın kayıtlı olup olmadığını öğrenmenin
    // yolu olurdu.
    expect(res.status()).toBe(200);
  });
});
