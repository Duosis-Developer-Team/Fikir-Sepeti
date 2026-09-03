import { test, expect } from "@playwright/test";
import { hashPassword, verifyPassword } from "../../lib/password";

/**
 * Parola hash'leme testi.
 *
 * İlk yazımda scrypt parametreleri (N=32768, r=8) node'un VARSAYILAN 32 MiB
 * maxmem sınırına tam denk geliyordu ve her hash çağrısı
 * ERR_CRYPTO_INVALID_SCRYPT_PARAMS ile patlıyordu — yani hiç kimse kayıt
 * olamaz, hiç kimse giriş yapamazdı. Hata yalnızca çalışma zamanında görünen
 * cinstendi (tip hatası vermiyor), o yüzden test burada.
 */
test.describe("parola hash", () => {
  test("hash üretilir ve doğrulanır", async () => {
    const hash = await hashPassword("dogru-parola");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("dogru-parola", hash)).toBe(true);
  });

  test("yanlış parola reddedilir", async () => {
    const hash = await hashPassword("dogru-parola");
    expect(await verifyPassword("yanlis-parola", hash)).toBe(false);
  });

  test("aynı parola her seferinde farklı hash verir (salt)", async () => {
    const a = await hashPassword("ayni");
    const b = await hashPassword("ayni");
    expect(a).not.toBe(b);
    expect(await verifyPassword("ayni", a)).toBe(true);
    expect(await verifyPassword("ayni", b)).toBe(true);
  });

  test("hash yoksa (Azure ile açılmış hesap) doğrulama false döner", async () => {
    expect(await verifyPassword("herhangi", null)).toBe(false);
  });

  test("bozuk hash formatı çökertmez", async () => {
    expect(await verifyPassword("x", "bozuk")).toBe(false);
    expect(await verifyPassword("x", "scrypt$1$2$3")).toBe(false);
  });
});
