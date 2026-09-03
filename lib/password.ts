import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Parola hash'leme — scrypt (node:crypto).
 *
 * `lib/server/auth.ts`'ten AYRI bir dosyada, çünkü testler ve seed betiği de
 * kullanıcı oluşturuyor; auth.ts `server-only` ile korunuyor ve Next dışında
 * import edilemiyor. Buradaki kod saf: ne veritabanı ne istek bağlamı.
 *
 * bcrypt/argon2 yerine scrypt: node'da yerleşik, alpine imajında derleyici
 * gerektirmiyor. N=2^15 → tek hash ~60-100ms.
 */
const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number }
) => Promise<Buffer>;

/**
 * maxmem AÇIKÇA veriliyor ve bu şart.
 *
 * scrypt'in bellek ihtiyacı ~128 * N * r = 128 * 32768 * 8 = tam 32 MiB.
 * Node'un varsayılan maxmem'i de 32 MiB ve kontrol "kesin küçük" olduğu için
 * bu parametreler varsayılanla ÇALIŞMIYOR:
 *   ERR_CRYPTO_INVALID_SCRYPT_PARAMS: memory limit exceeded
 * Yani sınır bilerek yükseltilmezse hiçbir parola hash'lenemez ve hiç kimse
 * giriş yapamazdı. (Seed betiği ilk çalıştırıldığında tam olarak bu oldu.)
 */
export const SCRYPT_PARAMS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;
const KEYLEN = 32;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEYLEN, SCRYPT_PARAMS);
  // Format: scrypt$N$r$p$salt$hash — parametreler hash'in yanında saklanıyor
  // ki ileride maliyet artırılırsa eski hash'ler doğrulanmaya devam etsin.
  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: SCRYPT_PARAMS.maxmem,
  });
  // Uzunluklar farklıysa timingSafeEqual fırlatır; önce kontrol et.
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
