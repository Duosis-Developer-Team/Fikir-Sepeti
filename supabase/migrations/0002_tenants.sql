-- S1: Platform → Tenant → User (flat tenant model)

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  azure_tenant_id text,
  email_domain text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create unique index if not exists tenants_azure_tenant_id_uidx
  on tenants (azure_tenant_id) where azure_tenant_id is not null;
create unique index if not exists tenants_email_domain_uidx
  on tenants (email_domain) where email_domain is not null;

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id text not null,
  email text,
  display_name text,
  created_at timestamptz default now(),
  unique (tenant_id, user_id)
);

create index if not exists app_users_email_idx on app_users (lower(email));

grant all on table tenants to anon, authenticated, service_role;
grant all on table app_users to anon, authenticated, service_role;
