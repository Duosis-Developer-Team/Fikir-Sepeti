-- S9: content moderation + audit log

create table if not exists public.content_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  pattern text not null,
  kind text not null default 'word' check (kind in ('word', 'regex')),
  action text not null default 'warn' check (action in ('warn', 'block')),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists content_rules_tenant_idx on public.content_rules (tenant_id);

create table if not exists public.content_flags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  entity_type text not null check (entity_type in ('idea', 'pool', 'feedback')),
  entity_id uuid not null,
  rule_id uuid references public.content_rules(id) on delete set null,
  matched_text text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'hidden')),
  created_by text,
  reviewed_by text,
  created_at timestamptz not null default now()
);

create index if not exists content_flags_tenant_status_idx
  on public.content_flags (tenant_id, status);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor text not null,
  action text not null,
  entity_type text,
  entity_id uuid,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_tenant_idx on public.audit_log (tenant_id, created_at desc);

alter table public.ideas
  add column if not exists hidden boolean not null default false;

alter table public.feedback
  add column if not exists hidden boolean not null default false;

alter table public.content_rules enable row level security;
alter table public.content_flags enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists content_rules_select on public.content_rules;
create policy content_rules_select on public.content_rules for select
  using (tenant_id = public.current_tenant_id());

drop policy if exists content_rules_write on public.content_rules;
create policy content_rules_write on public.content_rules for all
  using (
    tenant_id = public.current_tenant_id()
    and (
      public.has_perm('tenant.manage_settings')
      or public.has_perm('content.moderate')
    )
  )
  with check (
    tenant_id = public.current_tenant_id()
    and (
      public.has_perm('tenant.manage_settings')
      or public.has_perm('content.moderate')
    )
  );

drop policy if exists content_flags_select on public.content_flags;
create policy content_flags_select on public.content_flags for select
  using (
    tenant_id = public.current_tenant_id()
    and (
      public.has_perm('content.moderate')
      or created_by = coalesce(auth.jwt() ->> 'email', '')
    )
  );

drop policy if exists content_flags_write on public.content_flags;
create policy content_flags_write on public.content_flags for all
  using (
    tenant_id = public.current_tenant_id()
    and public.has_perm('content.moderate')
  )
  with check (
    tenant_id = public.current_tenant_id()
    and public.has_perm('content.moderate')
  );

drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log for select
  using (
    tenant_id = public.current_tenant_id()
    and (
      public.has_perm('tenant.manage_roles')
      or public.has_perm('content.moderate')
    )
  );

drop policy if exists audit_log_insert on public.audit_log;
create policy audit_log_insert on public.audit_log for insert
  with check (tenant_id = public.current_tenant_id());

-- Ordinary members cannot see hidden ideas; moderators can
drop policy if exists ideas_select on public.ideas;
create policy ideas_select on public.ideas for select
  using (
    tenant_id = public.current_tenant_id()
    and (
      coalesce(hidden, false) = false
      or public.has_perm('content.moderate')
    )
  );

-- Split feedback_all so hidden rows are filtered for members
drop policy if exists feedback_all on public.feedback;
create policy feedback_select on public.feedback for select
  using (
    tenant_id = public.current_tenant_id()
    and (
      coalesce(hidden, false) = false
      or public.has_perm('content.moderate')
    )
  );
create policy feedback_insert on public.feedback for insert
  with check (tenant_id = public.current_tenant_id());
create policy feedback_update on public.feedback for update
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
create policy feedback_delete on public.feedback for delete
  using (tenant_id = public.current_tenant_id());
