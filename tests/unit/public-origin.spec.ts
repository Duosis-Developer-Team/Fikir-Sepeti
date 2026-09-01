import { test, expect } from "@playwright/test";
import { publicOrigin } from "../../lib/request-origin";

/**
 * 2026-09-01 regresyonu: Microsoft girişi başarılı olduğu halde kullanıcı
 * `https://0.0.0.0:3000/login` adresine yönlendirildi. Next standalone
 * sunucusu isteği kendi bind adresiyle gördüğü için `req.url` böyleydi.
 */
const reqWith = (headers: Record<string, string>, url = "http://0.0.0.0:3000/api/x") =>
  new Request(url, { headers });

test.describe("publicOrigin", () => {
  test.afterEach(() => {
    delete process.env.PUBLIC_ORIGIN;
  });

  test("PUBLIC_ORIGIN her şeyin önünde gelir", () => {
    process.env.PUBLIC_ORIGIN = "https://fikirsepeti.example.com";
    expect(publicOrigin(reqWith({ host: "saldirgan.example" }))).toBe(
      "https://fikirsepeti.example.com"
    );
  });

  test("PUBLIC_ORIGIN sonundaki eğik çizgi atılır", () => {
    process.env.PUBLIC_ORIGIN = "https://fikirsepeti.example.com/";
    expect(publicOrigin(reqWith({}))).toBe("https://fikirsepeti.example.com");
  });

  test("yapılandırma yoksa proxy başlıklarından kurulur", () => {
    expect(
      publicOrigin(reqWith({ host: "fs.example.com", "x-forwarded-proto": "https" }))
    ).toBe("https://fs.example.com");
  });

  test("x-forwarded-host, host'tan önce gelir", () => {
    expect(
      publicOrigin(
        reqWith({ host: "ic-servis:3000", "x-forwarded-host": "fs.example.com" })
      )
    ).toBe("https://fs.example.com");
  });

  test("virgüllü zincirde ilk değer alınır", () => {
    expect(
      publicOrigin(
        reqWith({ "x-forwarded-host": "fs.example.com, ara-proxy", "x-forwarded-proto": "https, http" })
      )
    ).toBe("https://fs.example.com");
  });

  test("bind adresli host PUBLIC_ORIGIN'i gölgeleyemez", () => {
    process.env.PUBLIC_ORIGIN = "https://fs.example.com";
    expect(publicOrigin(reqWith({ host: "0.0.0.0:3000" }))).toBe("https://fs.example.com");
  });

  test("BİLİNEN SINIR: yapılandırma da başlık da yoksa bind adresine düşer", () => {
    // Kurtarılacak bilgi kalmıyor. Bu yüzden Azure callback'i mutlak URL
    // kurmak yerine GÖRECELİ Location veriyor — orada bu sınıra hiç
    // girilmiyor. publicOrigin sadece mutlak şart olan yerlerde kullanılıyor
    // (şifre sıfırlama e-postasındaki link, Azure redirect_uri fallback'i).
    expect(publicOrigin(reqWith({ host: "0.0.0.0:3000" }))).toBe("http://0.0.0.0:3000");
  });

  test("başlık hiç yoksa istek URL'ine düşer", () => {
    expect(publicOrigin(reqWith({}, "https://fs.example.com/api/x"))).toBe(
      "https://fs.example.com"
    );
  });
});
