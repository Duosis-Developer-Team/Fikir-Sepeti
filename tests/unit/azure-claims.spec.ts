import { test, expect } from "@playwright/test";
import { emailFromClaims } from "../../lib/server/azure";

/**
 * Eski `emailFromAuthUser` testinin yerini alıyor. Supabase Auth kaldırıldı;
 * Azure claim'lerini artık kendi OIDC katmanımız çözüyor ama SORU aynı:
 * birincil e-posta yoksa hangi claim'e düşülüyor?
 */
test.describe("emailFromClaims", () => {
  test("birincil email küçük harfe çevrilir", () => {
    expect(emailFromClaims({ email: "Admin@DuoSis.COM" })).toBe("admin@duosis.com");
  });

  test("email yoksa preferred_username'e düşer", () => {
    expect(emailFromClaims({ preferred_username: "azure.user@duosis.com" })).toBe(
      "azure.user@duosis.com"
    );
  });

  test("preferred_username de yoksa upn'e düşer", () => {
    expect(emailFromClaims({ upn: "legacy@duosis.com" })).toBe("legacy@duosis.com");
  });

  test("e-posta benzeri hiçbir claim yoksa null", () => {
    expect(emailFromClaims({ sub: "abc", preferred_username: "kullanici" })).toBeNull();
  });
});
