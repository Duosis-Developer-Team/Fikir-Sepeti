-- S1: attach tenant_id to all domain tables + backfill default DuoSis tenant

do $$
declare
  duo_id uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
begin
  insert into tenants (id, name, email_domain, settings)
  values (duo_id, 'DuoSis', 'duosis.dev', '{"moderation":"warn","voteVisibility":"moderators","whoCanCreateHackathon":"organizers","whoCanCreateEvent":"everyone","whoCanPostToPool":"everyone"}'::jsonb)
  on conflict (id) do nothing;

  -- ensure email_domain uniqueness path works even if conflict by id already inserted without domain
  update tenants set email_domain = coalesce(email_domain, 'duosis.dev') where id = duo_id;
end $$;

-- helpers: add nullable tenant_id if missing
do $$ begin
  alter table baskets add column tenant_id uuid references tenants(id) on delete cascade;
exception when duplicate_column then null; end $$;
do $$ begin
  alter table ideas add column tenant_id uuid references tenants(id) on delete cascade;
exception when duplicate_column then null; end $$;
do $$ begin
  alter table votes add column tenant_id uuid references tenants(id) on delete cascade;
exception when duplicate_column then null; end $$;
do $$ begin
  alter table teams add column tenant_id uuid references tenants(id) on delete cascade;
exception when duplicate_column then null; end $$;
do $$ begin
  alter table team_members add column tenant_id uuid references tenants(id) on delete cascade;
exception when duplicate_column then null; end $$;
do $$ begin
  alter table team_votes add column tenant_id uuid references tenants(id) on delete cascade;
exception when duplicate_column then null; end $$;
do $$ begin
  alter table feedback add column tenant_id uuid references tenants(id) on delete cascade;
exception when duplicate_column then null; end $$;
do $$ begin
  alter table hackathon_participants add column tenant_id uuid references tenants(id) on delete cascade;
exception when duplicate_column then null; end $$;
do $$ begin
  alter table squad_members add column tenant_id uuid references tenants(id) on delete cascade;
exception when duplicate_column then null; end $$;

-- backfill from baskets → children (orphan rows → DuoSis)
update baskets set tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' where tenant_id is null;
update ideas i set tenant_id = b.tenant_id from baskets b where i.basket_id = b.id and i.tenant_id is null;
update votes v set tenant_id = b.tenant_id from baskets b where v.basket_id = b.id and v.tenant_id is null;
update teams t set tenant_id = b.tenant_id from baskets b where t.basket_id = b.id and t.tenant_id is null;
update team_members tm set tenant_id = b.tenant_id from baskets b where tm.basket_id = b.id and tm.tenant_id is null;
update team_votes tv set tenant_id = b.tenant_id from baskets b where tv.basket_id = b.id and tv.tenant_id is null;
update feedback f set tenant_id = b.tenant_id from baskets b where f.basket_id = b.id and f.tenant_id is null;
update hackathon_participants hp set tenant_id = b.tenant_id from baskets b where hp.basket_id = b.id and hp.tenant_id is null;
update squad_members sm set tenant_id = b.tenant_id from baskets b where sm.basket_id = b.id and sm.tenant_id is null;

-- leftover orphans (no basket) → DuoSis
update ideas set tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' where tenant_id is null;
update votes set tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' where tenant_id is null;
update teams set tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' where tenant_id is null;
update team_members set tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' where tenant_id is null;
update team_votes set tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' where tenant_id is null;
update feedback set tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' where tenant_id is null;
update hackathon_participants set tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' where tenant_id is null;
update squad_members set tenant_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' where tenant_id is null;

-- populate app_users from known creators / participants
insert into app_users (tenant_id, user_id, email, display_name)
select distinct 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid, created_by, created_by, created_by
from baskets
where created_by is not null
on conflict (tenant_id, user_id) do nothing;

insert into app_users (tenant_id, user_id, email, display_name)
select distinct coalesce(hp.tenant_id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid), hp.user_id, hp.email, hp.display_name
from hackathon_participants hp
on conflict (tenant_id, user_id) do nothing;

-- enforce NOT NULL (idempotent: ignore if already not null)
do $$ begin alter table baskets alter column tenant_id set not null; exception when others then null; end $$;
do $$ begin alter table ideas alter column tenant_id set not null; exception when others then null; end $$;
do $$ begin alter table votes alter column tenant_id set not null; exception when others then null; end $$;
do $$ begin alter table teams alter column tenant_id set not null; exception when others then null; end $$;
do $$ begin alter table team_members alter column tenant_id set not null; exception when others then null; end $$;
do $$ begin alter table team_votes alter column tenant_id set not null; exception when others then null; end $$;
do $$ begin alter table feedback alter column tenant_id set not null; exception when others then null; end $$;
do $$ begin alter table hackathon_participants alter column tenant_id set not null; exception when others then null; end $$;
do $$ begin alter table squad_members alter column tenant_id set not null; exception when others then null; end $$;

create index if not exists baskets_tenant_id_idx on baskets (tenant_id);
create index if not exists ideas_tenant_id_idx on ideas (tenant_id);
create index if not exists votes_tenant_id_idx on votes (tenant_id);
