-- Takim kurulurken (rastgele/otomatik dagitim) uyelerden biri "lider" olarak
-- isaretlenir — sadece lider (ya da zaten yonetebilen organizator/admin)
-- takimin adini degistirebilir. RLS zaten teams_all ile genis (tenant
-- icinde herkese acik) oldugu icin burada politika degisikligi gerekmiyor,
-- yetki kontrolu app/api/hackathon/[basketId]/teams/route.ts'de.

alter table teams add column if not exists leader_user_id text;
