-- S4: Kavanoz (idea_pool) + pool_votes + RLS + realtime

create table if not exists idea_pool (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  text text not null,
  brief text,
  category text,
  track_hint text check (track_hint is null or track_hint in ('hackathon', 'etkinlik')),
  status text not null default 'new'
    check (status in ('new', 'voting', 'promoted', 'archived', 'rejected')),
  hidden boolean not null default false,
  created_by text not null,
  vote_count int not null default 0,
  promoted_basket_id uuid references baskets(id) on delete set null,
  source_basket_id uuid references baskets(id) on delete set null,
  poll_closes_at timestamptz,
  winner_label text,
  created_at timestamptz default now()
);

create index if not exists idea_pool_tenant_created_idx
  on idea_pool (tenant_id, created_at desc);
create index if not exists idea_pool_tenant_status_idx
  on idea_pool (tenant_id, status);

create table if not exists pool_votes (
  id uuid primary key default gen_random_uuid(),
  pool_idea_id uuid not null references idea_pool(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  voter text not null,
  created_at timestamptz default now(),
  unique (pool_idea_id, voter)
);

create index if not exists pool_votes_tenant_idx on pool_votes (tenant_id);

create or replace function bump_pool_vote_count() returns trigger as $$
begin
  if (TG_OP = 'INSERT') then
    update idea_pool set vote_count = vote_count + 1 where id = NEW.pool_idea_id;
  elsif (TG_OP = 'DELETE') then
    update idea_pool set vote_count = greatest(0, vote_count - 1) where id = OLD.pool_idea_id;
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists pool_vote_count_trigger on pool_votes;
create trigger pool_vote_count_trigger
after insert or delete on pool_votes
for each row execute function bump_pool_vote_count();

alter table idea_pool enable row level security;
alter table pool_votes enable row level security;

drop policy if exists idea_pool_select on idea_pool;
drop policy if exists idea_pool_insert on idea_pool;
drop policy if exists idea_pool_update on idea_pool;
drop policy if exists idea_pool_delete on idea_pool;
drop policy if exists pool_votes_select on pool_votes;
drop policy if exists pool_votes_insert on pool_votes;
drop policy if exists pool_votes_delete on pool_votes;

create policy idea_pool_select on idea_pool for select
  using (
    tenant_id = public.current_tenant_id()
    and (hidden = false or public.has_perm('content.moderate'))
  );

create policy idea_pool_insert on idea_pool for insert
  with check (
    tenant_id = public.current_tenant_id()
    and public.has_perm('pool.create')
    and (created_by = public.current_app_user_id() or created_by = public.jwt_email())
  );

create policy idea_pool_update on idea_pool for update
  using (tenant_id = public.current_tenant_id());

create policy idea_pool_delete on idea_pool for delete
  using (
    tenant_id = public.current_tenant_id()
    and (
      created_by = public.current_app_user_id()
      or created_by = public.jwt_email()
      or public.has_perm('content.moderate')
    )
  );

create policy pool_votes_select on pool_votes for select
  using (
    tenant_id = public.current_tenant_id()
    and (
      public.has_perm('vote.view_all')
      or voter = public.current_app_user_id()
      or voter = public.jwt_email()
    )
  );

create policy pool_votes_insert on pool_votes for insert
  with check (
    tenant_id = public.current_tenant_id()
    and (voter = public.current_app_user_id() or voter = public.jwt_email())
  );

create policy pool_votes_delete on pool_votes for delete
  using (
    tenant_id = public.current_tenant_id()
    and (
      voter = public.current_app_user_id()
      or voter = public.jwt_email()
      or public.has_perm('vote.view_all')
    )
  );

create or replace function public.list_my_pool_votes()
returns table (pool_idea_id uuid)
language sql stable security definer set search_path = public as $$
  select v.pool_idea_id
  from pool_votes v
  where v.tenant_id = public.current_tenant_id()
    and (v.voter = public.current_app_user_id() or v.voter = public.jwt_email());
$$;

grant execute on function public.list_my_pool_votes() to anon, authenticated, service_role;

do $$
begin
  alter publication supabase_realtime add table idea_pool;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table pool_votes;
exception when duplicate_object then null;
end $$;
