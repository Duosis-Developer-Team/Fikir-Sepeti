-- Hotfix: multi-domain tenant resolution + production duosis.com
-- Idempotent: safe to re-run.

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

-- Also keep other.com for Other Corp if present via email_domain backfill

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
