/**
 * Tarayıcının gördüğü origin — mutlak yönlendirme ve link kurmanın TEK doğru
 * yolu.
 *
 * `new URL(req.url).origin` KULLANMAYIN: Next standalone sunucusu isteği kendi
 * bind adresiyle görüyor ve `req.url` `http://0.0.0.0:3000/...` olabiliyor.
 * 2026-09-01'de Microsoft girişinde tam olarak bu oldu — giriş BAŞARILIYDI
 * (kimlik ve oturum veritabanında oluştu), ama dönüş yönlendirmesi
 * `https://0.0.0.0:3000/login` olduğu için kullanıcı "bu siteye ulaşılamıyor"
 * ekranını gördü. Aynı hata şifre sıfırlama e-postasındaki linki de
 * kullanılamaz yapıyordu.
 *
 * Sıra: açık yapılandırma → proxy başlıkları → son çare istek URL'i.
 * `PUBLIC_ORIGIN` verildiğinde Host başlığına hiç güvenilmiyor; yalnızca
 * başlığa dayanan linkler host enjeksiyonuna açık olurdu (özellikle şifre
 * sıfırlama: saldırganın host'uyla üretilmiş bir link jetonu taşır).
 *
 * `lib/server/auth.ts` yerine burada duruyor çünkü o dosya veritabanı
 * havuzunu import ediyor ve testlerden import edilemiyor (bkz. lib/password.ts
 * için verilen aynı gerekçe).
 */
export function publicOrigin(req: Request): string {
  const configured = process.env.PUBLIC_ORIGIN?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const first = (v: string | null) => v?.split(",")[0].trim() || "";
  const host = first(req.headers.get("x-forwarded-host")) || first(req.headers.get("host"));
  // 0.0.0.0 / [::] → sunucunun kendi bind adresi; tarayıcıya verilemez.
  if (host && !/^(0\.0\.0\.0|\[?::\]?)(:|$)/.test(host)) {
    const proto = first(req.headers.get("x-forwarded-proto")) || "https";
    return `${proto}://${host}`;
  }
  return new URL(req.url).origin;
}
