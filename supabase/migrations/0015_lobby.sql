-- S11: lobby lock + participant approval
alter table public.baskets
  add column if not exists lobby_locked boolean not null default false;

alter table public.hackathon_participants
  add column if not exists approved boolean not null default true;
