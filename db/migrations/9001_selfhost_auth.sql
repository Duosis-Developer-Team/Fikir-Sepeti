-- ============================================================================
-- Self-host kimlik katmanı — Supabase Auth (GoTrue) yerine geçer.
--
-- NUMARALANDIRMA: 9xxx bilinçli. Ekip `supabase/migrations/` altında 0025,
-- 0026 ... diye devam ediyor; bizim dosyalarımız 9000'den başlayınca aynı
-- numarayı iki kişinin alması ihtimali kalmıyor ve sıralama da doğru kalıyor
-- (migrate.mjs önce compat, sonra supabase/migrations, sonra db/migrations).
--
-- GoTrue'nun bizde karşılığı olan parçaları:
--   auth.users               → auth_credentials
--   refresh token / session  → auth_sessions   (opak token, hash'li saklanır)
--   recovery token           → auth_password_resets
--   OAuth state/PKCE         → auth_oauth_states
--   e-posta gönderimi        → email_outbox    (provider=log_only)
-- ============================================================================

-- ── Kimlik bilgileri ────────────────────────────────────────────────────────
-- E-posta uygulamanın her yerinde kullanıcı anahtarı (app_users.user_id,
-- votes.voter, baskets.created_by hep e-posta). Burada da öyle: küçük harfe
-- normalize edilmiş e-posta birincil anahtar.
create table if not exists auth_credentials (
  email           text primary key check (position('@' in email) > 1),
  -- scrypt (node:crypto) — format: scrypt$N$r$p$<salt_b64>$<hash_b64>.
  -- Azure ile giren kullanıcının şifresi hiç olmaz → null.
  password_hash   text,
  email_verified  boolean not null default false,
  -- 'password' | 'azure'  — ilk kayıt yolu (teşhis için; giriş bunu kısıtlamaz)
  provider        text not null default 'password' check (provider in ('password', 'azure')),
  azure_object_id text,
  display_name    text,
  disabled_at     timestamptz,
  last_login_at   timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists auth_credentials_azure_oid_uidx
  on auth_credentials (azure_object_id) where azure_object_id is not null;

-- ── Oturumlar ───────────────────────────────────────────────────────────────
-- Stateless JWT yerine DB'de oturum: çıkış yapmak ve bir hesabın tüm
-- oturumlarını iptal etmek gerçekten mümkün olsun diye. Çerezde ham token
-- gider, burada YALNIZCA sha256'sı durur — DB dökümü oturum çalmaya yetmez.
create table if not exists auth_sessions (
  id          uuid primary key default gen_random_uuid(),
  token_hash  text not null unique,
  email       text not null references auth_credentials(email) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  revoked_at  timestamptz,
  last_seen_at timestamptz not null default now(),
  user_agent  text,
  ip          text
);

create index if not exists auth_sessions_email_idx on auth_sessions (email);
create index if not exists auth_sessions_expiry_idx on auth_sessions (expires_at)
  where revoked_at is null;

-- ── Şifre sıfırlama ─────────────────────────────────────────────────────────
create table if not exists auth_password_resets (
  token_hash text primary key,
  email      text not null references auth_credentials(email) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at    timestamptz
);

create index if not exists auth_password_resets_email_idx on auth_password_resets (email);

-- ── OAuth (Azure Entra) geçici durumu ───────────────────────────────────────
-- Authorization-code + PKCE akışında state ve code_verifier'ın yönlendirme
-- turunu atlatması gerekiyor. Çereze koymak yerine burada: birden çok web
-- pod'u varken (replicas > 1) çerezsiz de tutarlı çalışır.
create table if not exists auth_oauth_states (
  state         text primary key,
  code_verifier text not null,
  redirect_to   text,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  consumed_at   timestamptz
);

create index if not exists auth_oauth_states_expiry_idx on auth_oauth_states (expires_at);

-- ── E-posta kutusu ──────────────────────────────────────────────────────────
-- LOGISLOT'taki log_only deseninin aynısı: sağlayıcı yokken e-postalar
-- gönderilmez, buraya YAZILIR. Böylece "doğrulama linki gitti mi" sorusunun
-- cevabı her zaman bir SELECT uzaklıkta olur ve SMTP gelince tek config
-- değişikliğiyle gerçek gönderime geçilir.
create table if not exists email_outbox (
  id         uuid primary key default gen_random_uuid(),
  to_email   text not null,
  subject    text not null,
  body       text not null,
  kind       text not null,               -- 'verify' | 'reset' | ...
  status     text not null default 'logged' check (status in ('logged', 'sent', 'failed')),
  error      text,
  created_at timestamptz not null default now(),
  sent_at    timestamptz
);

create index if not exists email_outbox_created_idx on email_outbox (created_at desc);

-- ── Yetkiler ────────────────────────────────────────────────────────────────
-- Bu tablolar tenant verisi DEĞİL, kimlik altyapısı: RLS yok, çünkü onları
-- okuyan tek şey sunucunun kendisi ve okumayı yapan kod henüz kimin
-- giriş yaptığını BİLMİYOR (tam olarak onu belirlemeye çalışıyor).
--
-- 0001'deki `alter default privileges ... to anon, authenticated, service_role`
-- yüzünden bu tablolar da otomatik olarak anon'a açılırdı. anon rolüyle kimse
-- bağlanamıyor (NOLOGIN) ama yetkiyi yine de geri alıyoruz: parola hash'lerine
-- erişimi "zaten kimse o rolü kullanamıyor" gerekçesiyle açık bırakmak,
-- ileride o rol birine verildiğinde sessiz bir açığa dönüşür.
revoke all on auth_credentials, auth_sessions, auth_password_resets,
               auth_oauth_states, email_outbox from anon;

grant select, insert, update, delete
  on auth_credentials, auth_sessions, auth_password_resets,
     auth_oauth_states, email_outbox
  to fikirsepeti_app;

-- ── Bakım ───────────────────────────────────────────────────────────────────
-- Süresi geçmiş oturum/token/state temizliği. Cron yok; /api/auth/* yolları
-- ucuz olduğu için ara sıra çağırıyor (bkz. lib/server/auth.ts → sweepExpired).
create or replace function public.auth_sweep_expired() returns void
language sql
as $$
  delete from auth_sessions where expires_at < now() - interval '7 days';
  delete from auth_password_resets where expires_at < now() - interval '1 day';
  delete from auth_oauth_states where expires_at < now() - interval '1 hour';
$$;

grant execute on function public.auth_sweep_expired() to fikirsepeti_app;
