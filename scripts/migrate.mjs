#!/usr/bin/env node
/**
 * Şema migration çalıştırıcısı — düz PostgreSQL (Supabase CLI'sız).
 *
 * SIRA (değiştirmeyin, birbirine bağımlı):
 *   1. db/compat/          Supabase taklidi: auth.jwt(), anon/authenticated
 *                          rolleri, supabase_realtime publication, uygulama
 *                          rolü. Bunlar olmadan 2. adım hata verir.
 *   2. supabase/migrations/ Şemanın TEK doğru kaynağı. Ekip buraya yeni
 *                          migration eklemeye devam ediyor; dosyalar burada
 *                          DEĞİŞTİRİLMEDEN çalışıyor.
 *   3. db/migrations/      Self-host eklentileri (9xxx): kimlik tabloları,
 *                          NOTIFY tetikleyicileri.
 *
 * Uygulanan her dosya schema_migrations'a adı + sha256'sıyla yazılır; ikinci
 * çalıştırmada atlanır. Bu yüzden migration Job'u her deploy'da güvenle koşar.
 *
 * Bağlantı: ADMIN_DATABASE_URL (tablo sahibi / superuser). Uygulamanın kendi
 * bağlantısı (fikirsepeti_app) BAŞKA ve daha yetkisizdir — RLS'in uygulamaya
 * da işlemesi için (bkz. db/compat/0000_supabase_compat.sql).
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import pg from "pg";

const ROOT = resolve(import.meta.dirname, "..");

const SOURCES = [
  { dir: "db/compat", label: "compat" },
  { dir: "supabase/migrations", label: "schema" },
  { dir: "db/migrations", label: "selfhost" },
];

const adminUrl = process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL;
const appPassword = process.env.APP_DB_PASSWORD;
const allowDrift = process.env.ALLOW_CHECKSUM_DRIFT === "1";

if (!adminUrl) {
  console.error("ADMIN_DATABASE_URL (veya DATABASE_URL) gerekli.");
  process.exit(1);
}
if (!appPassword) {
  console.error(
    "APP_DB_PASSWORD gerekli — uygulama rolü (fikirsepeti_app) bu parolayla oluşturulur/güncellenir."
  );
  process.exit(1);
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function collect() {
  const files = [];
  for (const { dir, label } of SOURCES) {
    const abs = join(ROOT, dir);
    if (!existsSync(abs)) {
      console.warn(`uyarı: ${dir} yok, atlanıyor`);
      continue;
    }
    const entries = readdirSync(abs)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const name of entries) {
      files.push({
        // Kayıt anahtarı yolu içeriyor: iki farklı kaynakta aynı dosya adı
        // (ör. 0001_init.sql) birbirini "uygulanmış" sanmasın.
        key: `${dir}/${name}`,
        label,
        sql: readFileSync(join(abs, name), "utf8"),
      });
    }
  }
  return files;
}

async function main() {
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();

  try {
    // Uygulama rolünün parolası compat dosyasına GUC ile geçiyor — SQL'e
    // gömülmediği için migration çıktısında/loglarda görünmüyor.
    await client.query("select set_config('fikirsepeti.app_password', $1, false)", [
      appPassword,
    ]);

    await client.query(`
      create table if not exists schema_migrations (
        name        text primary key,
        checksum    text not null,
        applied_at  timestamptz not null default now(),
        duration_ms integer
      )
    `);

    const { rows } = await client.query("select name, checksum from schema_migrations");
    const applied = new Map(rows.map((r) => [r.name, r.checksum]));

    const files = collect();
    let ran = 0;
    let skipped = 0;

    for (const file of files) {
      const checksum = sha256(file.sql);
      const previous = applied.get(file.key);

      if (previous) {
        if (previous !== checksum && !allowDrift) {
          console.error(
            `\nHATA: ${file.key} uygulandıktan SONRA değiştirilmiş.\n` +
              `  kayıtlı: ${previous.slice(0, 12)}  şimdiki: ${checksum.slice(0, 12)}\n` +
              `  Uygulanmış bir migration'ı düzenlemek, o düzenlemeyi hiç görmemiş\n` +
              `  veritabanlarıyla sessizce ayrışmaya yol açar. Doğrusu YENİ bir\n` +
              `  migration eklemek. Gerçekten kasıtlıysa: ALLOW_CHECKSUM_DRIFT=1`
          );
          process.exit(1);
        }
        skipped++;
        continue;
      }

      const started = Date.now();
      process.stdout.write(`→ ${file.key} ... `);
      try {
        await client.query("begin");
        await client.query(file.sql);
        const ms = Date.now() - started;
        await client.query(
          "insert into schema_migrations (name, checksum, duration_ms) values ($1, $2, $3)",
          [file.key, checksum, ms]
        );
        await client.query("commit");
        console.log(`ok (${ms}ms)`);
        ran++;
      } catch (err) {
        await client.query("rollback").catch(() => {});
        console.log("HATA");
        console.error(`\n${file.key} uygulanamadı:\n  ${err.message}`);
        if (err.position) {
          // Postgres karakter ofseti veriyor; hangi satır olduğunu göstermek
          // 300 satırlık bir migration'da aramaktan çok daha hızlı.
          const upto = file.sql.slice(0, Number(err.position));
          const line = upto.split("\n").length;
          console.error(`  satır ~${line}: ${file.sql.split("\n")[line - 1]?.trim()}`);
        }
        process.exit(1);
      }
    }

    console.log(`\nBitti: ${ran} uygulandı, ${skipped} zaten vardı.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
