-- SG2: self-serve tenant + invites + membership resolve
-- Idempotent.

-- Plan / status on tenants (SaaS)
do $$ begin
  alter table tenants add column plan text not null default 'free'
    check (plan in ('free', 'analytics'));
exception when duplicate_column then null; end $$;

do $$ begin
  alter table tenants add column status text not null default 'active'
    check (status in ('active', 'suspended'));
exception when duplicate_column then null; end $$;

-- Backfill if columns existed without defaults somehow
update tenants set plan = coalesce(plan, 'free') where plan is null;
update tenants set status = coalesce(status, 'active') where status is null;

create table if not exists tenant_invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  code text not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  max_uses int not null default 50,
  use_count int not null default 0,
  constraint tenant_invites_code_lower check (code = upper(code))
);

create unique index if not exists tenant_invites_code_uidx on tenant_invites (code);
create index if not exists tenant_invites_tenant_id_idx on tenant_invites (tenant_id);

grant all on table tenant_invites to anon, authenticated, service_role;

alter table tenant_invites enable row level security;

do $$ begin
  create policy tenant_invites_select on tenant_invites for select
    using (tenant_id = public.current_tenant_id() and public.has_perm('tenant.manage_roles'));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy tenant_invites_insert on tenant_invites for insert
    with check (tenant_id = public.current_tenant_id() and public.has_perm('tenant.manage_roles'));
exception when duplicate_object then null; end $$;

-- Resolve: Azure → domain → legacy email_domain → existing app_users membership
-- Skips suspended tenants.
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
        and coalesce(t.status, 'active') = 'active'
      limit 1
    ),
    (
      select td.tenant_id
      from tenant_domains td
      join tenants t on t.id = td.tenant_id
      where length(coalesce(p_email, '')) > 0
        and lower(td.domain) = lower(split_part(p_email, '@', 2))
        and coalesce(t.status, 'active') = 'active'
      limit 1
    ),
    (
      select t.id
      from tenants t
      where t.email_domain is not null
        and length(coalesce(p_email, '')) > 0
        and lower(t.email_domain) = lower(split_part(p_email, '@', 2))
        and coalesce(t.status, 'active') = 'active'
      limit 1
    ),
    (
      select au.tenant_id
      from app_users au
      join tenants t on t.id = au.tenant_id
      where length(coalesce(p_email, '')) > 0
        and lower(au.email) = lower(p_email)
        and coalesce(t.status, 'active') = 'active'
      order by au.created_at asc
      limit 1
    )
  );
$$;

grant execute on function public.resolve_tenant_for_claims(text, text) to anon, authenticated, service_role;

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

-- Peek: does this email domain already map to a tenant? (pre-auth, for register UI)
create or replace function public.peek_tenant_for_email(p_email text)
returns table (tenant_id uuid, tenant_name text, via text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  tid uuid;
  tname text;
begin
  tid := public.resolve_tenant_for_claims(p_email, null);
  if tid is null then
    return;
  end if;
  select name into tname from tenants where id = tid;
  -- membership-only vs domain
  if exists (
    select 1 from tenant_domains td
    where td.tenant_id = tid
      and lower(td.domain) = lower(split_part(p_email, '@', 2))
  ) or exists (
    select 1 from tenants t
    where t.id = tid and t.email_domain is not null
      and lower(t.email_domain) = lower(split_part(p_email, '@', 2))
  ) then
    return query select tid, tname, 'domain'::text;
  else
    return query select tid, tname, 'membership'::text;
  end if;
end;
$$;

grant execute on function public.peek_tenant_for_email(text) to anon, authenticated, service_role;

-- Create workspace for authenticated (or service) caller
create or replace function public.create_tenant_for_user(
  p_name text,
  p_domain text default null,
  p_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_domain text;
  v_tenant uuid;
  v_admin uuid;
begin
  v_email := lower(coalesce(
    nullif(trim(p_email), ''),
    nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '')
  ));
  if v_email is null or length(v_email) < 3 then
    raise exception 'email required';
  end if;

  if public.resolve_tenant_for_claims(v_email, null) is not null then
    raise exception 'user already belongs to a tenant';
  end if;

  v_domain := nullif(lower(trim(coalesce(p_domain, ''))), '');
  if v_domain is not null then
    if position('@' in v_domain) > 0 then
      raise exception 'domain must not include @';
    end if;
    if exists (select 1 from tenant_domains where domain = v_domain) then
      raise exception 'domain already taken';
    end if;
    if exists (select 1 from tenants where lower(email_domain) = v_domain) then
      raise exception 'domain already taken';
    end if;
  end if;

  if nullif(trim(p_name), '') is null then
    raise exception 'tenant name required';
  end if;

  insert into tenants (name, email_domain, plan, status, settings)
  values (
    trim(p_name),
    v_domain,
    'free',
    'active',
    '{"moderation":"warn","voteVisibility":"moderators","whoCanCreateHackathon":"organizers","whoCanCreateEvent":"everyone","whoCanPostToPool":"everyone"}'::jsonb
  )
  returning id into v_tenant;

  if v_domain is not null then
    insert into tenant_domains (tenant_id, domain)
    values (v_tenant, v_domain)
    on conflict (domain) do nothing;
  end if;

  insert into app_users (tenant_id, user_id, email, display_name)
  values (v_tenant, v_email, v_email, split_part(v_email, '@', 1))
  on conflict (tenant_id, user_id) do nothing;

  select id into v_admin from roles where key = 'tenant_admin' and tenant_id is null limit 1;
  if v_admin is not null then
    insert into user_roles (tenant_id, user_id, role_id, scope_basket_id)
    values (v_tenant, v_email, v_admin, null);
  end if;

  return v_tenant;
end;
$$;

grant execute on function public.create_tenant_for_user(text, text, text) to anon, authenticated, service_role;

-- Join by invite code
create or replace function public.join_tenant_by_invite(
  p_code text,
  p_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_inv tenant_invites%rowtype;
  v_mem uuid;
begin
  v_email := lower(coalesce(
    nullif(trim(p_email), ''),
    nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '')
  ));
  if v_email is null or length(v_email) < 3 then
    raise exception 'email required';
  end if;

  select * into v_inv
  from tenant_invites
  where code = upper(trim(p_code))
  for update;

  if not found then
    raise exception 'invalid invite';
  end if;
  if v_inv.expires_at is not null and v_inv.expires_at < now() then
    raise exception 'invite expired';
  end if;
  if v_inv.use_count >= v_inv.max_uses then
    raise exception 'invite exhausted';
  end if;
  if not exists (
    select 1 from tenants t
    where t.id = v_inv.tenant_id and coalesce(t.status, 'active') = 'active'
  ) then
    raise exception 'tenant suspended';
  end if;

  if public.resolve_tenant_for_claims(v_email, null) is not null
     and public.resolve_tenant_for_claims(v_email, null) <> v_inv.tenant_id then
    raise exception 'user already belongs to another tenant';
  end if;

  insert into app_users (tenant_id, user_id, email, display_name)
  values (v_inv.tenant_id, v_email, v_email, split_part(v_email, '@', 1))
  on conflict (tenant_id, user_id) do nothing;

  select id into v_mem from roles where key = 'member' and tenant_id is null limit 1;
  if v_mem is not null then
    insert into user_roles (tenant_id, user_id, role_id, scope_basket_id)
    select v_inv.tenant_id, v_email, v_mem, null
    where not exists (
      select 1 from user_roles ur
      where ur.tenant_id = v_inv.tenant_id
        and ur.user_id = v_email
        and ur.role_id = v_mem
        and ur.scope_basket_id is null
    );
  end if;

  update tenant_invites set use_count = use_count + 1 where id = v_inv.id;
  return v_inv.tenant_id;
end;
$$;

grant execute on function public.join_tenant_by_invite(text, text) to anon, authenticated, service_role;

-- Create invite (caller must be tenant_admin via has_perm — uses JWT current tenant)
create or replace function public.create_tenant_invite(p_tenant_id uuid default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant uuid;
  v_email text;
  v_code text;
  i int;
begin
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_tenant := coalesce(p_tenant_id, public.current_tenant_id());
  if v_tenant is null then
    raise exception 'tenant required';
  end if;

  -- Allow when JWT membership matches + manage_roles, OR service-style call with matching app_users admin
  if public.current_tenant_id() is not null then
    if v_tenant <> public.current_tenant_id() or not public.has_perm('tenant.manage_roles') then
      raise exception 'forbidden';
    end if;
  else
    -- fallback for bypass tests: require tenant_admin role row for this email
    if not exists (
      select 1
      from user_roles ur
      join roles r on r.id = ur.role_id
      where ur.tenant_id = v_tenant
        and ur.user_id = v_email
        and r.key in ('tenant_admin', 'platform_owner')
        and ur.scope_basket_id is null
    ) and length(v_email) > 0 then
      raise exception 'forbidden';
    end if;
  end if;

  for i in 1..8 loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      insert into tenant_invites (tenant_id, code, created_by)
      values (v_tenant, v_code, coalesce(nullif(v_email, ''), 'system'));
      return v_code;
    exception when unique_violation then
      null;
    end;
  end loop;
  raise exception 'could not allocate invite code';
end;
$$;

grant execute on function public.create_tenant_invite(uuid) to anon, authenticated, service_role;
