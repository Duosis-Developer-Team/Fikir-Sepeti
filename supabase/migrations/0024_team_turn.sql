-- Sıralı takım puanlama/feedback: hangi takımın sırası olduğu + o sıranın
-- bitiş zamanı (opsiyonel — admin süre koymadıysa null kalır, sadece elle
-- geç / herkes bitirince geç işler).

alter table baskets add column if not exists team_turn_idx int not null default 0;
alter table baskets add column if not exists team_turn_ends_at timestamptz;
