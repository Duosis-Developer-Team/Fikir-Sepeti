-- S3: RLS isolation + helpers + vote masking RPC

create or replace function public.jwt_email() returns text
language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.current_app_user()
returns table (tenant_id uuid, user_id text, email text)
language sql stable security definer set search_path = public as $$
  select au.tenant_id, au.user_id, au.email
  from app_users au
  where lower(au.email) = public.jwt_email()
  limit 1;
$$;

create or replace function public.current_tenant_id() returns uuid
language sql stable security definer set search_path = public as $$
  select tenant_id from public.current_app_user();
$$;

create or replace function public.current_app_user_id() returns text
language sql stable security definer set search_path = public as $$
  select user_id from public.current_app_user();
$$;

create or replace function public.has_perm(perm text, basket uuid default null)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from user_roles ur
    join role_permissions rp on rp.role_id = ur.role_id
    where ur.tenant_id = public.current_tenant_id()
      and ur.user_id = public.current_app_user_id()
      and rp.permission_key = perm
      and (ur.scope_basket_id is null or ur.scope_basket_id = basket)
  );
$$;

grant execute on function public.jwt_email() to anon, authenticated, service_role;
grant execute on function public.current_app_user() to anon, authenticated, service_role;
grant execute on function public.current_tenant_id() to anon, authenticated, service_role;
grant execute on function public.current_app_user_id() to anon, authenticated, service_role;
grant execute on function public.has_perm(text, uuid) to anon, authenticated, service_role;

-- Enable RLS on all domain tables
alter table tenants enable row level security;
alter table app_users enable row level security;
alter table roles enable row level security;
alter table role_permissions enable row level security;
alter table user_roles enable row level security;
alter table baskets enable row level security;
alter table ideas enable row level security;
alter table votes enable row level security;
alter table teams enable row level security;
alter table team_members enable row level security;
alter table team_votes enable row level security;
alter table feedback enable row level security;
alter table hackathon_participants enable row level security;
alter table squad_members enable row level security;

-- Drop old permissive policies if re-run
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- tenants: see own tenant
create policy tenants_select on tenants for select
  using (id = public.current_tenant_id() or public.has_perm('tenant.manage_settings'));

create policy tenants_update on tenants for update
  using (id = public.current_tenant_id() and public.has_perm('tenant.manage_settings'));

-- app_users: same tenant
create policy app_users_select on app_users for select
  using (tenant_id = public.current_tenant_id());
create policy app_users_insert on app_users for insert
  with check (tenant_id = public.current_tenant_id());
create policy app_users_update on app_users for update
  using (tenant_id = public.current_tenant_id());

-- roles: system + own tenant
create policy roles_select on roles for select
  using (tenant_id is null or tenant_id = public.current_tenant_id());
create policy role_permissions_select on role_permissions for select using (true);

create policy user_roles_select on user_roles for select
  using (tenant_id = public.current_tenant_id());
create policy user_roles_write on user_roles for all
  using (tenant_id = public.current_tenant_id() and public.has_perm('tenant.manage_roles'))
  with check (tenant_id = public.current_tenant_id() and public.has_perm('tenant.manage_roles'));

-- baskets
create policy baskets_select on baskets for select
  using (tenant_id = public.current_tenant_id());
create policy baskets_insert on baskets for insert
  with check (tenant_id = public.current_tenant_id());
create policy baskets_update on baskets for update
  using (tenant_id = public.current_tenant_id());
create policy baskets_delete on baskets for delete
  using (tenant_id = public.current_tenant_id() and created_by = public.current_app_user_id());

-- ideas
create policy ideas_select on ideas for select
  using (tenant_id = public.current_tenant_id());
create policy ideas_insert on ideas for insert
  with check (tenant_id = public.current_tenant_id());
create policy ideas_update on ideas for update
  using (tenant_id = public.current_tenant_id());
create policy ideas_delete on ideas for delete
  using (tenant_id = public.current_tenant_id());

-- votes: full row only with vote.view_all OR own vote; others use RPC
create policy votes_select_all on votes for select
  using (
    tenant_id = public.current_tenant_id()
    and (
      public.has_perm('vote.view_all')
      or voter = public.current_app_user_id()
      or voter = public.jwt_email()
    )
  );
create policy votes_insert on votes for insert
  with check (
    tenant_id = public.current_tenant_id()
    and (voter = public.current_app_user_id() or voter = public.jwt_email())
  );
create policy votes_delete on votes for delete
  using (
    tenant_id = public.current_tenant_id()
    and (voter = public.current_app_user_id() or voter = public.jwt_email() or public.has_perm('vote.view_all'))
  );

-- teams / members / team_votes / feedback / participants / squad
create policy teams_all on teams for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
create policy team_members_all on team_members for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
create policy team_votes_all on team_votes for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
create policy feedback_all on feedback for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
create policy hackathon_participants_all on hackathon_participants for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
create policy squad_members_all on squad_members for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- Masked votes RPC for clients without vote.view_all
create or replace function public.list_my_votes(p_basket uuid)
returns table (phase text, idea_id uuid)
language sql stable security definer set search_path = public as $$
  select v.phase, v.idea_id
  from votes v
  where v.basket_id = p_basket
    and v.tenant_id = public.current_tenant_id()
    and (v.voter = public.current_app_user_id() or v.voter = public.jwt_email());
$$;

grant execute on function public.list_my_votes(uuid) to anon, authenticated, service_role;

-- Anonymous tenant resolution by email domain (pre-auth)
create or replace function public.resolve_tenant_id_for_email(p_email text)
returns uuid
language sql stable security definer set search_path = public as $$
  select t.id
  from tenants t
  where t.email_domain is not null
    and lower(t.email_domain) = lower(split_part(p_email, '@', 2))
  limit 1;
$$;

grant execute on function public.resolve_tenant_id_for_email(text) to anon, authenticated, service_role;
