-- Fikir Sepeti — şema + realtime publication (Bölüm 4)

create table if not exists baskets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null default 'etkinlik',          -- 'etkinlik' | 'hackathon'
  resolve_method text not null default 'vote',    -- etkinlik: 'vote' | 'raffle'
  phase text not null default 'ideas',            -- ortak faz alanı
  status text not null default 'active',           -- 'active' | 'resolved'
  winner_idea_id uuid,
  selected_idea_id uuid,                          -- hackathon: seçilen fikir
  config jsonb not null default '{}'::jsonb,      -- hackathon config (idea/team/süre modülleri)
  hackathon_ends_at timestamptz,                  -- hackathon fazı geri sayım bitişi
  current_demo_idx int default 0,                 -- presenter: kaçıncı demo sahnede
  created_by text,
  created_at timestamptz default now()
);
-- phase değerleri:
--   etkinlik:  'ideas' -> 'resolved'
--   hackathon: 'lobby' -> 'idea' -> 'team' -> 'demo' -> 'feedback' -> 'production' -> 'done'

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

-- ── hackathon modüler tabloları ──
create table if not exists hackathon_participants (
  id uuid primary key default gen_random_uuid(),
  basket_id uuid not null references baskets(id) on delete cascade,
  user_id text not null,                          -- Azure kimliği (e-posta)
  email text,
  display_name text,
  role text not null default 'member',            -- 'admin' | 'member'
  joined_at timestamptz default now(),
  unique (basket_id, user_id)
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  basket_id uuid not null references baskets(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  basket_id uuid not null references baskets(id) on delete cascade,
  user_id text not null,
  unique (team_id, user_id)
);

create table if not exists team_votes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  basket_id uuid not null references baskets(id) on delete cascade,
  voter text not null,
  created_at timestamptz default now(),
  unique (basket_id, voter)                        -- demo fazında kişi başı 1 oy
);

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  basket_id uuid not null references baskets(id) on delete cascade,
  team_id uuid references teams(id) on delete cascade,
  idea_id uuid references ideas(id) on delete cascade,
  author_id text,
  author_name text,
  text text not null,
  created_at timestamptz default now()
);

alter table baskets disable row level security;
alter table ideas disable row level security;
alter table votes disable row level security;
alter table squad_members disable row level security;
alter table hackathon_participants disable row level security;
alter table teams disable row level security;
alter table team_members disable row level security;
alter table team_votes disable row level security;
alter table feedback disable row level security;

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
  begin execute 'alter publication supabase_realtime add table hackathon_participants'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table teams'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table team_members'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table team_votes'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table feedback'; exception when duplicate_object then null; end;
end $$;
