-- =============================================================================
-- D1 — Production Supabase migration bundle (0006 → 0009)
-- =============================================================================
-- HOW TO RUN:
--   Supabase Dashboard → SQL Editor → New query → paste ALL of this → Run.
--   Safe to re-run: every statement is idempotent (IF NOT EXISTS / ON CONFLICT
--   DO NOTHING / CREATE OR REPLACE / duplicate_object guards).
--
-- PREREQUISITE: migrations 0001–0005 must already be applied in production
--   (tenants, RBAC, RLS helpers: current_tenant_id(), has_perm(),
--    current_app_user_id(), jwt_email()). If login worked before with the
--   "Unidentified Tenant" screen, these are present. If any function-missing
--   error appears, apply 0001–0005 first, then re-run this file.
--
-- WHY: production DB was behind the deployed code. This bundle adds the Kavanoz
--   pool (S4), multi-domain tenant resolution + duosis.com (login hotfix),
--   team↔idea assignment (S6) and rubric scores (S7).
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 0006_idea_pool.sql — S4: Kavanoz (idea_pool) + pool_votes + RLS + realtime
-- ─────────────────────────────────────────────────────────────────────────────

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


-- ─────────────────────────────────────────────────────────────────────────────
-- 0007_tenant_domains.sql — multi-domain tenant resolution + duosis.com
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists tenant_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  domain text not null,
  created_at timestamptz default now(),
  constraint tenant_domains_domain_lower check (domain = lower(domain))
);

create unique index if not exists tenant_domains_domain_uidx on tenant_domains (domain);
create index if not exists tenant_domains_tenant_id_idx on tenant_domains (tenant_id);

grant all on table tenant_domains to anon, authenticated, service_role;

-- Backfill from legacy tenants.email_domain
insert into tenant_domains (tenant_id, domain)
select id, lower(email_domain)
from tenants
where email_domain is not null
on conflict (domain) do nothing;

-- DuoSis production domain (real work email @duosis.com)
insert into tenant_domains (tenant_id, domain)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, 'duosis.com')
on conflict (domain) do nothing;

alter table tenant_domains enable row level security;

do $$ begin
  create policy tenant_domains_select on tenant_domains for select
    using (tenant_id = public.current_tenant_id() or public.has_perm('tenant.manage_settings'));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy tenant_domains_insert on tenant_domains for insert
    with check (tenant_id = public.current_tenant_id() and public.has_perm('tenant.manage_settings'));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy tenant_domains_update on tenant_domains for update
    using (tenant_id = public.current_tenant_id() and public.has_perm('tenant.manage_settings'));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy tenant_domains_delete on tenant_domains for delete
    using (tenant_id = public.current_tenant_id() and public.has_perm('tenant.manage_settings'));
exception when duplicate_object then null; end $$;

-- Prefer Azure tid, then tenant_domains, then legacy email_domain
create or replace function public.resolve_tenant_for_claims(p_email text, p_azure_tid text default null)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select t.id
      from tenants t
      where p_azure_tid is not null
        and length(trim(p_azure_tid)) > 0
        and t.azure_tenant_id is not null
        and t.azure_tenant_id = trim(p_azure_tid)
      limit 1
    ),
    (
      select td.tenant_id
      from tenant_domains td
      where length(coalesce(p_email, '')) > 0
        and lower(td.domain) = lower(split_part(p_email, '@', 2))
      limit 1
    ),
    (
      select t.id
      from tenants t
      where t.email_domain is not null
        and length(coalesce(p_email, '')) > 0
        and lower(t.email_domain) = lower(split_part(p_email, '@', 2))
      limit 1
    )
  );
$$;

grant execute on function public.resolve_tenant_for_claims(text, text) to anon, authenticated, service_role;

-- Keep legacy RPC as thin wrapper (tests / older clients)
create or replace function public.resolve_tenant_id_for_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select public.resolve_tenant_for_claims(p_email, null);
$$;

grant execute on function public.resolve_tenant_id_for_email(text) to anon, authenticated, service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 0008_team_idea_assignment.sql — S6: team ↔ idea assignment + team angle
-- ─────────────────────────────────────────────────────────────────────────────

do $$ begin
  alter table teams add column idea_id uuid references ideas(id) on delete set null;
exception when duplicate_column then null; end $$;

do $$ begin
  alter table teams add column angle text;
exception when duplicate_column then null; end $$;

create index if not exists teams_idea_id_idx on teams (idea_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 0009_scores.sql — S7: rubric scores + realtime
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  basket_id uuid not null references baskets(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  voter text not null,
  category_key text not null,
  stars int not null check (stars between 1 and 5),
  is_jury boolean not null default false,
  created_at timestamptz default now(),
  unique (basket_id, team_id, voter, category_key)
);

create index if not exists scores_basket_idx on scores (basket_id);
create index if not exists scores_tenant_idx on scores (tenant_id);

grant all on table scores to anon, authenticated, service_role;

alter table scores enable row level security;

do $$ begin
  create policy scores_select on scores for select
    using (tenant_id = public.current_tenant_id());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy scores_insert on scores for insert
    with check (
      tenant_id = public.current_tenant_id()
      and (voter = public.current_app_user_id() or voter = public.jwt_email())
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy scores_update on scores for update
    using (
      tenant_id = public.current_tenant_id()
      and (voter = public.current_app_user_id() or voter = public.jwt_email())
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy scores_delete on scores for delete
    using (
      tenant_id = public.current_tenant_id()
      and (
        voter = public.current_app_user_id()
        or voter = public.jwt_email()
        or public.has_perm('hackathon.manage')
      )
    );
exception when duplicate_object then null; end $$;

do $$
begin
  alter publication supabase_realtime add table scores;
exception when duplicate_object then null;
end $$;

-- =============================================================================
-- VERIFY (optional): after running, this should return the DuoSis tenant id
--   select public.resolve_tenant_for_claims('someone@duosis.com', null);
--   -- expected: aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
-- =============================================================================
