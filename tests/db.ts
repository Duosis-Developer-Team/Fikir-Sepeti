import { Pool, type PoolClient } from "pg";
import { makeDb, type Db } from "../lib/server/pgrest";

/**
 * Testler için doğrudan veritabanı erişimi.
 *
 * `createClient(url, SERVICE_ROLE_KEY)` yerine geçer: testler kurulum verisi
 * yazarken RLS'i atlaması gerekiyor. Sahip rolüyle bağlanılıyor (Postgres'te
 * tablo sahibi RLS'e tabi değil), yani service_role'ün yaptığı işin aynısı.
 *
 * API kasıtlı olarak Supabase istemcisiyle aynı (`.from().select().eq()`),
 * böylece 13 test dosyasındaki sorgular değişmedi.
 */
let pool: Pool | null = null;
let appPool: Pool | null = null;

function adminPool(): Pool {
  if (pool) return pool;
  const url = process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("ADMIN_DATABASE_URL gerekli (testler için sahip rolü)");
  pool = new Pool({ connectionString: url, max: 5 });
  return pool;
}

/** Uygulamanın kullandığı rol (RLS'e TABİ). İzolasyon testleri bunu kullanıyor. */
function appRolePool(): Pool {
  if (appPool) return appPool;
  const url = process.env.APP_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("APP_DATABASE_URL gerekli (uygulama rolü: fikirsepeti_app)");
  appPool = new Pool({ connectionString: url, max: 3 });
  return appPool;
}

/** RLS'i atlayan admin erişimi — kurulum/doğrulama için. */
export function serviceClient(): Db {
  const run = async <R,>(fn: (client: PoolClient) => Promise<R>): Promise<R> => {
    const client = await adminPool().connect();
    try {
      return await fn(client);
    } finally {
      client.release();
    }
  };
  return makeDb(run);
}

/**
 * Belirli bir kullanıcının kimliğiyle, RLS ALTINDA erişim.
 * İzolasyon testleri bunu kullanıyor: "A'nın kullanıcısı B'nin satırlarını
 * görebiliyor mu?" sorusunun cevabı uygulamadaki yolun aynısından geçmeli.
 */
export function asUser(email: string | null): Db {
  const run = async <R,>(fn: (client: PoolClient) => Promise<R>): Promise<R> => {
    const client = await appRolePool().connect();
    try {
      await client.query("begin");
      if (email) await client.query("select set_config('app.user_email', $1, true)", [email]);
      const out = await fn(client);
      await client.query("commit");
      return out;
    } catch (e) {
      await client.query("rollback").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  };
  return makeDb(run);
}

/**
 * Test kullanıcısı oluştur — `supabase.auth.admin.createUser` yerine.
 * E-posta doğrulaması bu kurulumda kapalı olduğu için doğrudan
 * kullanılabilir bir hesap yaratıyor.
 */
export async function createAuthUser(email: string, password: string): Promise<void> {
  const { hashPassword } = await import("../lib/password");
  const hash = await hashPassword(password);
  await serviceClient()
    .from("auth_credentials")
    .upsert(
      {
        email: email.toLowerCase(),
        password_hash: hash,
        email_verified: true,
        provider: "password",
        display_name: email.split("@")[0],
      },
      { onConflict: "email" }
    );
}
