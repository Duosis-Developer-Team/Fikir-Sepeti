-- Fikir Sepeti — şema + realtime publication (Bölüm 4)

create table if not exists baskets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null default 'social',            -- 'social' | 'build'
  resolve_method text not null default 'vote',    -- sosyal: 'vote' | 'raffle'
  phase text not null default 'ideas',            -- ortak faz alanı
  status text not null default 'active',           -- 'active' | 'resolved'
  winner_idea_id uuid,
  current_demo_idx int default 0,                 -- presenter: kaçıncı demo sahnede
  created_by text,
  created_at timestamptz default now()
);
-- phase değerleri:
--   sosyal: 'ideas' -> 'resolved'
--   build:  'ideas' -> 'finalists' -> 'demos' -> 'voting' -> 'squad' -> 'resolved'

create table if not exists ideas (
  id uuid primary key default gen_random_uuid(),
  basket_id uuid not null references baskets(id) on delete cascade,
  text text not null,
  tag text,
  is_finalist boolean not null default false,
  demo_url text,
  presenter text,
  live_at text,
  created_by text,
  vote_count int not null default 0,
  created_at timestamptz default now()
);

create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references ideas(id) on delete cascade,
  basket_id uuid not null references baskets(id) on delete cascade,
  phase text not null default 'ideas',
  voter text not null,
  created_at timestamptz default now(),
  unique (basket_id, phase, voter)                -- sepet+faz başına 1 oy
);

create table if not exists squad_members (
  id uuid primary key default gen_random_uuid(),
  basket_id uuid not null references baskets(id) on delete cascade,
  member text not null,
  created_at timestamptz default now(),
  unique (basket_id, member)
);

alter table baskets disable row level security;
alter table ideas disable row level security;
alter table votes disable row level security;
alter table squad_members disable row level security;

-- oy sayacı
create or replace function bump_vote_count() returns trigger as $$
begin
  if (TG_OP = 'INSERT') then
    update ideas set vote_count = vote_count + 1 where id = NEW.idea_id;
  elsif (TG_OP = 'DELETE') then
    update ideas set vote_count = vote_count - 1 where id = OLD.idea_id;
  end if;
  return null;
end; $$ language plpgsql;

drop trigger if exists vote_count_trigger on votes;
create trigger vote_count_trigger
after insert or delete on votes
for each row execute function bump_vote_count();

-- ★ REALTIME: tabloları publication'a ekle (idempotent)
do $$
begin
  begin execute 'alter publication supabase_realtime add table votes'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table ideas'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table baskets'; exception when duplicate_object then null; end;
end $$;
