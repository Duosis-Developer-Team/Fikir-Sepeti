-- Uygulama öneri panosu: herkes yazar, herkes okur (tenant içinde).

create table if not exists suggestions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  text text not null,
  created_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists suggestions_tenant_created_idx
  on suggestions (tenant_id, created_at desc);

alter table suggestions enable row level security;

drop policy if exists suggestions_select on suggestions;
drop policy if exists suggestions_insert on suggestions;

create policy suggestions_select on suggestions for select
  using (tenant_id = public.current_tenant_id());

create policy suggestions_insert on suggestions for insert
  with check (
    tenant_id = public.current_tenant_id()
    and (created_by = public.current_app_user_id() or created_by = public.jwt_email())
  );
