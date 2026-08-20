-- FS-17: üretim veri temizliği — HAZIRLANDI, ÇALIŞTIRILMADI.
-- Bu ajan üretim verisi silmez; bu dosya yalnızca Duo'nun (veya yetkili
-- birinin) gözden geçirip elle çalıştırması içindir.
--
-- Sırayla:
--   1) Önce SELECT'leri çalıştır, dönen satırları gözden geçir.
--   2) Sayılar/beklentiler uyuşuyorsa, altındaki UPDATE/DELETE'i çalıştır.
--   3) DuoSis tenant'ının gerçek id'sini elle doğrulamadan hiçbir
--      satırı silme — bu dosyadaki tenant araması isme göre yapılıyor,
--      koddaki DUOSIS_TENANT_ID sabiti yerel/CI seed'i için, üretimde
--      farklı bir id olabilir.

-- ─── 1. Test tenant'ı: "MCP Probe Co" ────────────────────────────────

-- Önce doğrula:
select id, name, email_domain, plan, status,
       (select count(*) from app_users where tenant_id = tenants.id) as user_count
from tenants
where name = 'MCP Probe Co';

-- Uygun görünüyorsa (silmek yerine askıya al — geri alınabilir):
-- update tenants set status = 'suspended' where name = 'MCP Probe Co';


-- ─── 2. Anlamsız / test başlıklı sepet fikirleri ─────────────────────

-- Önce doğrula — hangi tenant'ta, kim atmış, ne zaman:
select id, tenant_id, text, created_by, created_at
from idea_pool
where text in ('test', 'aa', 'adad', 'nasıl yapacağım?', 'drake nin adı arca olsun');

-- Uygun görünüyorsa:
-- delete from idea_pool
-- where text in ('test', 'aa', 'adad', 'nasıl yapacağım?', 'drake nin adı arca olsun');


-- ─── 3. Moderasyon kuralları: "arca" (bir ekip üyesinin adı), "maaş" ──

-- Önce doğrula:
select id, tenant_id, pattern, kind, action, enabled, created_at
from content_rules
where pattern in ('arca', 'maaş');

-- Uygun görünüyorsa:
-- delete from content_rules where pattern in ('arca', 'maaş');


-- ─── 4. (Opsiyonel) Bu tenant'ın demo/test verisini analitikten hariç tut ──
-- Önce 0021_demo_flag.sql migration'ı uygulanmış olmalı.
-- MCP Probe Co gibi test tenant'larına ait sepetleri toptan işaretlemek için:
--
-- update baskets set is_demo = true
-- where tenant_id = (select id from tenants where name = 'MCP Probe Co');
