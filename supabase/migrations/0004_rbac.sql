-- S2: RBAC — roles, permissions, user_roles

create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade, -- null = system role
  key text not null,
  label text not null,
  is_system boolean not null default false
);

create unique index if not exists roles_system_key_uidx on roles (key) where tenant_id is null;
create unique index if not exists roles_tenant_key_uidx on roles (tenant_id, key) where tenant_id is not null;

create table if not exists role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_key text not null,
  unique (role_id, permission_key)
);

create table if not exists user_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id text not null,
  role_id uuid not null references roles(id) on delete cascade,
  scope_basket_id uuid references baskets(id) on delete cascade
);

create unique index if not exists user_roles_global_uidx
  on user_roles (tenant_id, user_id, role_id) where scope_basket_id is null;
create unique index if not exists user_roles_scoped_uidx
  on user_roles (tenant_id, user_id, role_id, scope_basket_id) where scope_basket_id is not null;

create index if not exists user_roles_user_idx on user_roles (tenant_id, user_id);

grant all on table roles to anon, authenticated, service_role;
grant all on table role_permissions to anon, authenticated, service_role;
grant all on table user_roles to anon, authenticated, service_role;

do $$
declare
  r_owner uuid := 'c0000000-0000-4000-8000-000000000001';
  r_tadmin uuid := 'c0000000-0000-4000-8000-000000000002';
  r_mod uuid := 'c0000000-0000-4000-8000-000000000003';
  r_org uuid := 'c0000000-0000-4000-8000-000000000004';
  r_jury uuid := 'c0000000-0000-4000-8000-000000000005';
  r_mem uuid := 'c0000000-0000-4000-8000-000000000006';
  r_spec uuid := 'c0000000-0000-4000-8000-000000000007';
begin
  insert into roles (id, tenant_id, key, label, is_system) values
    (r_owner, null, 'platform_owner', 'Platform Owner', true),
    (r_tadmin, null, 'tenant_admin', 'Tenant Admin', true),
    (r_mod, null, 'moderator', 'Moderator', true),
    (r_org, null, 'organizer', 'Organizer', true),
    (r_jury, null, 'jury', 'Jury', true),
    (r_mem, null, 'member', 'Member', true),
    (r_spec, null, 'spectator', 'Spectator', true)
  on conflict (id) do nothing;

  delete from role_permissions where role_id in (r_owner, r_tadmin, r_mod, r_org, r_jury, r_mem, r_spec);

  insert into role_permissions (role_id, permission_key)
  select r_owner, unnest(array[
    'hackathon.create','etkinlik.create','pool.create','pool.promote',
    'content.moderate','vote.view_all','archive.view_all','analytics.view',
    'tenant.manage_roles','tenant.manage_settings','hackathon.jury','hackathon.manage'
  ]);

  insert into role_permissions (role_id, permission_key)
  select r_tadmin, unnest(array[
    'hackathon.create','etkinlik.create','pool.create','pool.promote',
    'content.moderate','vote.view_all','archive.view_all','analytics.view',
    'tenant.manage_roles','tenant.manage_settings','hackathon.jury','hackathon.manage'
  ]);

  insert into role_permissions (role_id, permission_key)
  select r_mod, unnest(array[
    'content.moderate','vote.view_all','pool.create','etkinlik.create'
  ]);

  insert into role_permissions (role_id, permission_key)
  select r_org, unnest(array[
    'hackathon.create','etkinlik.create','pool.create','pool.promote','hackathon.manage'
  ]);

  insert into role_permissions (role_id, permission_key)
  values (r_jury, 'hackathon.jury');

  insert into role_permissions (role_id, permission_key)
  select r_mem, unnest(array['etkinlik.create','pool.create']);

  insert into user_roles (tenant_id, user_id, role_id)
  select au.tenant_id, au.user_id, r_mem
  from app_users au
  where not exists (
    select 1 from user_roles ur
    where ur.tenant_id = au.tenant_id and ur.user_id = au.user_id
      and ur.role_id = r_mem and ur.scope_basket_id is null
  );

  insert into user_roles (tenant_id, user_id, role_id)
  select distinct b.tenant_id, b.created_by, r_org
  from baskets b
  where b.created_by is not null
    and not exists (
      select 1 from user_roles ur
      where ur.tenant_id = b.tenant_id and ur.user_id = b.created_by
        and ur.role_id = r_org and ur.scope_basket_id is null
    );

  insert into user_roles (tenant_id, user_id, role_id)
  select au.tenant_id, au.user_id, r_tadmin
  from app_users au
  where au.email = 'admin@duosis.dev'
    and not exists (
      select 1 from user_roles ur
      where ur.tenant_id = au.tenant_id and ur.user_id = au.user_id
        and ur.role_id = r_tadmin and ur.scope_basket_id is null
    );
end $$;
