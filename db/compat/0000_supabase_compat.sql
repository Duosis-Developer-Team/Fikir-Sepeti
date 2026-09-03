-- ============================================================================
-- Supabase → düz PostgreSQL uyumluluk katmanı.
--
-- NEDEN BU DOSYA VAR:
-- `supabase/migrations/` altındaki 24 migration şemanın tek doğru kaynağı ve
-- ekip onlara yenilerini eklemeye devam ediyor. Onları elle "düz Postgres"e
-- çevirmek, her yeni migration'da tekrarlanacak bir çeviri borcu yaratırdı ve
-- iki şema sessizce birbirinden ayrılırdı.
--
-- Onun yerine Supabase'in migration'larda KULLANILAN küçük yüzeyi burada
-- taklit ediliyor. Tüm yüzey bu kadar (kaynak: grep):
--   1. auth.jwt()                     → 4 çağrı (0005, 0010, 0014)
--   2. anon/authenticated/service_role → 33 grant
--   3. supabase_realtime publication   → 12 alter
-- Bu üçü karşılandığında migration'lar TEK KARAKTER değişmeden çalışır.
--
-- SIRA: migrate.mjs bunu her zaman supabase/migrations/*'tan ÖNCE uygular.
-- Idempotent — tekrar çalıştırmak güvenli.
-- ============================================================================

-- ── 1. Supabase'in yerleşik rolleri ─────────────────────────────────────────
-- Migration'lardaki `grant ... to anon, authenticated, service_role` satırları
-- bu roller yoksa hata verir. NOLOGIN olarak açılıyorlar: kimse bunlarla
-- bağlanamaz, sadece yetki taşıyıcısı (grup) olarak varlar.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

-- ── 2. auth şeması + auth.jwt() ─────────────────────────────────────────────
-- Supabase'de auth.jwt() isteğin JWT'sini döner ve RLS politikaları oradan
-- e-postayı okur. Bizde JWT yok: Next.js sunucusu her isteği bir transaction'da
-- açıp `SET LOCAL app.user_email = '<e-posta>'` yazıyor (bkz. lib/server/pg.ts
-- → withIdentity). Bu fonksiyon o GUC'u JWT şeklinde paketleyip döndürüyor,
-- böylece 0005'teki jwt_email() ve tüm RLS politikaları OLDUĞU GİBİ çalışıyor.
--
-- GUC set edilmemişse current_setting(..., true) NULL döner → e-posta ''
-- olur → politikalar hiçbir satırı eşleştirmez. Yani varsayılan davranış
-- "her şeyi gör" değil, FAIL-CLOSED. Bu bilinçli.
create schema if not exists auth;

create or replace function auth.jwt() returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'email', coalesce(current_setting('app.user_email', true), ''),
    'sub',   coalesce(current_setting('app.user_email', true), ''),
    'role',  coalesce(current_setting('app.role', true), 'authenticated')
  );
$$;

-- auth.uid(): şu an hiçbir migration kullanmıyor, ama Supabase'den kopyalanan
-- yeni bir politika kullanırsa sessizce patlamasın diye burada.
create or replace function auth.uid() returns text
language sql
stable
as $$
  select nullif(coalesce(current_setting('app.user_email', true), ''), '');
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.jwt() to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- ── 3. supabase_realtime publication ────────────────────────────────────────
-- Migration'lar tabloları bu publication'a ekliyor. Bizim realtime'ımız
-- LISTEN/NOTIFY üzerinden (9002_realtime_notify.sql) — yani publication
-- fonksiyonel olarak KULLANILMIYOR. Yine de var olması gerekiyor ki
-- `alter publication supabase_realtime add table ...` satırları hata vermesin.
-- Ayrıca ileride logical replication istenirse hazır durur.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

-- ── 4. Uygulama rolü ────────────────────────────────────────────────────────
-- Next.js sunucusu buradan bağlanır. Tabloların SAHİBİ DEĞİLDİR — bu kasıtlı:
-- Postgres'te tablo sahibi RLS'i atlar (FORCE ROW LEVEL SECURITY yoksa), yani
-- uygulama sahip rolüyle bağlansaydı 0005'teki tüm izolasyon politikaları
-- sessizce devre dışı kalırdı.
--
-- `authenticated` grubuna üye yapılıyor: migration'ların o role verdiği tüm
-- grant'ları (mevcut ve gelecek `alter default privileges` dahil) miras alır.
-- Böylece her yeni tablo için ayrıca grant yazmak gerekmez.
do $$
declare
  v_password text := current_setting('fikirsepeti.app_password', true);
begin
  if v_password is null or length(v_password) = 0 then
    raise exception 'fikirsepeti.app_password GUC ayarlanmadan bu migration çalıştırılamaz (migrate.mjs bunu APP_DB_PASSWORD''dan verir)';
  end if;

  if not exists (select 1 from pg_roles where rolname = 'fikirsepeti_app') then
    execute format('create role fikirsepeti_app login password %L', v_password);
  else
    -- Parola rotasyonu: secret değişirse migration tekrar koşunca eşitlenir.
    execute format('alter role fikirsepeti_app login password %L', v_password);
  end if;
end $$;

grant authenticated to fikirsepeti_app;
grant usage on schema public to fikirsepeti_app;
grant usage on schema auth to fikirsepeti_app;
