-- S7: rubric scores + realtime

create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  basket_id uuid not null references baskets(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  voter text not null,
  category_key text not null,
  stars int not null check (stars between 1 and 5),
  is_jury boolean not null default false,
  created_at timestamptz default now(),
  unique (basket_id, team_id, voter, category_key)
);

create index if not exists scores_basket_idx on scores (basket_id);
create index if not exists scores_tenant_idx on scores (tenant_id);

grant all on table scores to anon, authenticated, service_role;

alter table scores enable row level security;

do $$ begin
  create policy scores_select on scores for select
    using (tenant_id = public.current_tenant_id());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy scores_insert on scores for insert
    with check (
      tenant_id = public.current_tenant_id()
      and (voter = public.current_app_user_id() or voter = public.jwt_email())
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy scores_update on scores for update
    using (
      tenant_id = public.current_tenant_id()
      and (voter = public.current_app_user_id() or voter = public.jwt_email())
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy scores_delete on scores for delete
    using (
      tenant_id = public.current_tenant_id()
      and (
        voter = public.current_app_user_id()
        or voter = public.jwt_email()
        or public.has_perm('hackathon.manage')
      )
    );
exception when duplicate_object then null; end $$;

do $$
begin
  alter publication supabase_realtime add table scores;
exception when duplicate_object then null;
end $$;
