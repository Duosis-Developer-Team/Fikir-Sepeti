-- ============================================================================
-- Realtime — Supabase Realtime yerine LISTEN/NOTIFY.
--
-- MEVCUT DAVRANIŞ KORUNUYOR: istemci tarafındaki 12 abonelik iki gruba ayrılıyor
--   (a) çoğu: olay gelince sadece yeniden çekiyor (`() => load()`)
--   (b) ikisi: satırın kendisini kullanıyor — useRealtimeVotes (ideas INSERT/
--       UPDATE/DELETE ile listeyi yerinde günceller) ve useRealtimePool.
-- Bu yüzden payload SATIRIN TAMAMINI taşıyor; (a) grubu onu yok sayıyor,
-- (b) grubu Supabase'deki `payload.new / payload.old / payload.eventType`
-- şeklinin aynısını görüyor ve kodları değişmeden çalışıyor.
--
-- TEK KANAL ('fs_realtime') kullanılıyor, tablo başına ayrı kanal değil:
-- LISTEN başına bir bağlantı gerekir ve pod başına 12 boşta duran Postgres
-- bağlantısı, 10Gi'lik tek düğümlü bir Postgres için gereksiz pahalı olurdu.
-- Dağıtımı SSE ucu yapıyor (app/api/realtime/route.ts): tek LISTEN, süreç
-- içinde tenant + filtre eşleştirmesi.
-- ============================================================================

create or replace function public.fs_notify_change() returns trigger
language plpgsql
as $$
declare
  v_row     jsonb;
  v_payload jsonb;
  v_text    text;
begin
  v_row := case when TG_OP = 'DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;

  v_payload := jsonb_build_object(
    'table',     TG_TABLE_NAME,
    'eventType', TG_OP,                       -- INSERT | UPDATE | DELETE
    -- Yönlendirme anahtarları. SSE ucu iznin ötesine hiçbir satır göndermemek
    -- için önce tenant_id'ye, sonra aboneliğin filtresine bakıyor.
    -- baskets'ta basket_id kolonu yok; onun filtresi id üzerinden (row_id).
    'tenant_id', v_row ->> 'tenant_id',
    'basket_id', v_row ->> 'basket_id',
    'row_id',    v_row ->> 'id',
    'new',       case when TG_OP = 'DELETE' then null else to_jsonb(NEW) end,
    'old',       case when TG_OP = 'DELETE' then to_jsonb(OLD) else null end
  );

  v_text := v_payload::text;

  -- pg_notify'ın yükü 8000 bayttan küçük olmak ZORUNDA; aşarsa NOTIFY hata
  -- verir ve o hata tetikleyen INSERT/UPDATE'i de geri alır. Yani sınırı
  -- aşmak sadece bildirimi değil, KULLANICININ İŞLEMİNİ kaybettirirdi.
  -- Uzun bir fikir metni ya da feedback bunu tetikleyebilir; o durumda satır
  -- düşürülüp 'truncated' işaretleniyor, istemci de yeniden çekiyor
  -- (bkz. lib/realtime.ts — truncated gelirse refetch).
  if octet_length(v_text) > 7000 then
    v_payload := (v_payload - 'new' - 'old') || jsonb_build_object('truncated', true);
    v_text := v_payload::text;
  end if;

  perform pg_notify('fs_realtime', v_text);
  return null;
end;
$$;

-- Tetikleyiciler — YALNIZCA istemcinin gerçekten abone olduğu tablolar.
-- (grep: `table: "..."` → app/page.tsx, app/profil/page.tsx, HackathonRunner,
--  FeedbackStage, ProductionStage, useRealtimeVotes, useRealtimePool)
-- Yeni bir abonelik eklenirse tablo adını aşağıdaki listeye eklemek yeterli.
do $$
declare
  t text;
  tables text[] := array[
    'baskets',
    'ideas',
    'feedback',
    'hackathon_participants',
    'teams',
    'team_members',
    'team_votes',
    'scores',
    'idea_pool',
    'pool_votes'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is null then
      raise exception 'fs_notify: beklenen tablo yok: %', t;
    end if;
    execute format('drop trigger if exists fs_notify on public.%I', t);
    execute format(
      'create trigger fs_notify after insert or update or delete on public.%I
         for each row execute function public.fs_notify_change()', t);
  end loop;
end $$;
