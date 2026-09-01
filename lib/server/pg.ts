import "server-only";

import { Pool, type PoolClient } from "pg";

/**
 * PostgreSQL bağlantı havuzu — Supabase istemcisinin yerine geçer.
 *
 * GÜVENLİK MODELİ (en önemli kısım):
 * Uygulama `fikirsepeti_app` rolüyle bağlanır; bu rol tabloların SAHİBİ
 * DEĞİLDİR, dolayısıyla RLS ona da uygulanır. Kimlik her istekte transaction
 * içinde `SET LOCAL app.user_email` ile veriliyor ve 0005'teki tüm politikalar
 * bunu auth.jwt() üzerinden okuyor (bkz. db/compat/0000_supabase_compat.sql).
 *
 * Sonuç: tenant izolasyonu Supabase'deki gibi hâlâ VERİTABANINDA duruyor.
 * Bir route handler'da tenant_id filtresini unutmak veri sızdırmıyor — sorgu
 * boş dönüyor. Bu, izolasyonu tamamen uygulama koduna taşımaya kıyasla
 * bilinçli bir tercih: 32 route'un her birinde doğru yazmak zorunda olduğumuz
 * bir kural yerine, tek yerde duran ve varsayılanı "hiçbir şey görme" olan
 * bir kural.
 */

const globalForPg = globalThis as unknown as { _fsPool?: Pool };

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL tanımlı değil — uygulama veritabanına bağlanamaz (fikirsepeti-secrets)."
    );
  }
  return url;
}

export function pool(): Pool {
  // Next.js dev'de HMR modülü yeniden değerlendirir; globalThis'te tutulmazsa
  // her kaydetmede yeni bir havuz açılır ve bağlantılar birikir.
  if (globalForPg._fsPool) return globalForPg._fsPool;

  const p = new Pool({
    connectionString: connectionString(),
    // Tek web pod'u + tek düğümlü Postgres. max_connections varsayılanı 100;
    // LISTEN için ayrılan bağlantı ve migration Job'u da aynı havuzdan
    // yiyor, o yüzden bolca pay bırakılıyor.
    max: Number(process.env.PGPOOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    // Kubernetes içinde TLS yok (aynı namespace, cluster ağı). Dışarıdaki bir
    // Postgres'e bağlanılacaksa PGSSLMODE=require ile açılır.
    ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
  });

  // Havuzdaki boşta bir bağlantı ölürse (Postgres yeniden başladı, ağ koptu)
  // pg bunu 'error' olarak yayar. Dinlenmezse Node süreci komple düşer —
  // yani veritabanının kısa bir kesintisi web pod'unu öldürürdü.
  p.on("error", (err) => {
    console.error("pg havuzunda boşta bağlantı hatası:", err.message);
  });

  globalForPg._fsPool = p;
  return p;
}

/**
 * Bir kimlik altında sorgu çalıştırır. Her çağrı kendi transaction'ında koşar;
 * `set_config(..., true)` = SET LOCAL, yani ayar transaction bitince düşer ve
 * bağlantı havuza kimliksiz döner. (Bir sonraki isteğin başkasının kimliğini
 * devralması bu yüzden mümkün değil.)
 *
 * email null ise kimlik verilmez: politikalar hiçbir satırı eşleştirmez.
 * Bu, oturumsuz isteklerin doğru davranışıdır — "her şeyi gör" değil.
 */
export async function withIdentity<T>(
  email: string | null,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("begin");
    if (email) {
      await client.query("select set_config('app.user_email', $1, true)", [
        email.toLowerCase(),
      ]);
    }
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Kimlik gerektirmeyen, RLS'e tabi OLMAYAN tablolar için (auth_*, email_outbox).
 * Bu tablolarda RLS yok çünkü onları okuyan kod henüz kimin giriş yaptığını
 * belirlemeye ÇALIŞIYOR — yani kimlik daha yok. Tenant verisine bu yoldan
 * erişilmez; erişilse bile RLS yine devrede olurdu (rol aynı, sahip değil).
 */
export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const res = await pool().query(text, params as never);
  return res.rows as T[];
}

/** Tek satır bekleyen sorgular için kısayol. */
export async function queryOne<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
