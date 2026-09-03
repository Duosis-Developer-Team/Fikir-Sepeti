-- ============================================================================
-- İçerik bayrağı: gönderen kendi içeriği için bayrak OLUŞTURABİLİR.
--
-- NEDEN GEREKLİ:
-- Moderasyon akışı şöyle işliyor — sıradan bir üye uyarı listesindeki bir
-- kelimeyi içeren fikir gönderiyor, onaylıyor ve sistem o içeriği moderatör
-- kuyruğuna BAYRAKLIYOR (app/api/content/ideas → createFlags).
--
-- Ama 0014'teki content_flags_write politikası INSERT için de
-- `content.moderate` istiyordu. Yani bayrağı yazan kullanıcının zaten
-- moderatör olması gerekiyordu — ki bayrağı tetikleyen kişi tanımı gereği
-- moderatör DEĞİL.
--
-- Bu neden fark edilmemişti: Supabase kurulumunda sunucu service-role
-- anahtarıyla bağlanıyordu ve service-role RLS'i tamamen atlıyor. Politika
-- yanlıştı ama hiç uygulanmıyordu. Self-host'ta uygulama artık RLS'e tabi
-- bir rolle bağlandığı için politika ilk kez gerçekten çalıştı ve S9
-- moderasyon testi kırmızıya döndü.
--
-- Düzeltme, yetkiyi genişletmek değil DOĞRU yere koymak:
--   INSERT        → kendi içeriği için herkes, ya da moderatör
--   UPDATE/DELETE → yalnızca moderatör (inceleme/gizleme kararı)
-- content_flags_select zaten aynı ayrımı yapıyordu (gönderen kendi bayrağını
-- görebiliyor), yani niyet baştan buydu; yazma tarafı eksik kalmış.
-- ============================================================================

drop policy if exists content_flags_write on public.content_flags;

create policy content_flags_insert on public.content_flags for insert
  with check (
    tenant_id = public.current_tenant_id()
    and (
      public.has_perm('content.moderate')
      or created_by = public.current_app_user_id()
      or created_by = public.jwt_email()
    )
  );

-- İnceleme kararı (onayla / gizle) moderatöre ait — burada gevşetme YOK.
create policy content_flags_update on public.content_flags for update
  using (
    tenant_id = public.current_tenant_id()
    and public.has_perm('content.moderate')
  )
  with check (
    tenant_id = public.current_tenant_id()
    and public.has_perm('content.moderate')
  );

create policy content_flags_delete on public.content_flags for delete
  using (
    tenant_id = public.current_tenant_id()
    and public.has_perm('content.moderate')
  );
