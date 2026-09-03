-- Sepetteki fikirlere yorum yapılabilsin (talep #3).

create table if not exists idea_pool_comments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  pool_idea_id uuid not null references idea_pool(id) on delete cascade,
  author_id text,
  author_name text,
  text text not null,
  created_at timestamptz default now()
);

create index if not exists idea_pool_comments_idea_idx
  on idea_pool_comments (pool_idea_id, created_at asc);

alter table idea_pool_comments enable row level security;

drop policy if exists idea_pool_comments_select on idea_pool_comments;
drop policy if exists idea_pool_comments_insert on idea_pool_comments;
drop policy if exists idea_pool_comments_delete on idea_pool_comments;

create policy idea_pool_comments_select on idea_pool_comments for select
  using (tenant_id = public.current_tenant_id());

create policy idea_pool_comments_insert on idea_pool_comments for insert
  with check (
    tenant_id = public.current_tenant_id()
    and (author_id = public.current_app_user_id() or author_id = public.jwt_email())
  );

create policy idea_pool_comments_delete on idea_pool_comments for delete
  using (
    tenant_id = public.current_tenant_id()
    and (
      author_id = public.current_app_user_id()
      or author_id = public.jwt_email()
      or public.has_perm('content.moderate')
    )
  );

do $$
begin
  alter publication supabase_realtime add table idea_pool_comments;
exception when duplicate_object then null;
end $$;

-- content_flags.entity_type kısıtı yorumlara izin versin (moderasyon paneli
-- yorumları da işaretleyebilsin).
alter table content_flags drop constraint if exists content_flags_entity_type_check;
alter table content_flags add constraint content_flags_entity_type_check
  check (entity_type in ('idea', 'pool', 'feedback', 'pool_comment'));
