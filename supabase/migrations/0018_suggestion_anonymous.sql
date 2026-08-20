-- Öneri gönderirken "anonim" seçeneği — işaretlenirse gönderenin adı kimseye gösterilmez.

alter table suggestions add column if not exists anonymous boolean not null default false;
