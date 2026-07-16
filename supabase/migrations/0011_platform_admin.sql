-- SG3: platform.manage_tenants + platform_owner cross-tenant RLS
-- Idempotent.

-- Permission on platform_owner only
insert into role_permissions (role_id, permission_key)
select id, 'platform.manage_tenants'
from roles
where key = 'platform_owner' and tenant_id is null
on conflict (role_id, permission_key) do nothing;

-- Drop & recreate tenants select to include platform.manage_tenants (all tenants)
drop policy if exists tenants_select on tenants;
create policy tenants_select on tenants for select
  using (
    id = public.current_tenant_id()
    or public.has_perm('tenant.manage_settings')
    or public.has_perm('platform.manage_tenants')
  );

-- Platform owner can update any tenant's plan/status (admin panel)
drop policy if exists tenants_update on tenants;
create policy tenants_update on tenants for update
  using (
    (id = public.current_tenant_id() and public.has_perm('tenant.manage_settings'))
    or public.has_perm('platform.manage_tenants')
  );

-- Cross-tenant read for platform owner (admin detail)
drop policy if exists app_users_select on app_users;
create policy app_users_select on app_users for select
  using (
    tenant_id = public.current_tenant_id()
    or public.has_perm('platform.manage_tenants')
  );

drop policy if exists user_roles_select on user_roles;
create policy user_roles_select on user_roles for select
  using (
    tenant_id = public.current_tenant_id()
    or public.has_perm('platform.manage_tenants')
  );

-- Domains readable cross-tenant for platform owner
drop policy if exists tenant_domains_select on tenant_domains;
create policy tenant_domains_select on tenant_domains for select
  using (
    tenant_id = public.current_tenant_id()
    or public.has_perm('tenant.manage_settings')
    or public.has_perm('platform.manage_tenants')
  );

-- Helper: does JWT user hold platform.manage_tenants?
create or replace function public.is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_perm('platform.manage_tenants');
$$;

grant execute on function public.is_platform_owner() to anon, authenticated, service_role;
