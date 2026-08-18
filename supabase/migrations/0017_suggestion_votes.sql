-- Öneri panosuna oy: idea_pool/pool_votes ile aynı desen, tek yönlü (geri alınamaz).

alter table suggestions add column if not exists vote_count int not null default 0;

create table if not exists suggestion_votes (
  id uuid primary key default gen_random_uuid(),
  suggestion_id uuid not null references suggestions(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  voter text not null,
  created_at timestamptz default now(),
  unique (suggestion_id, voter)
);

create index if not exists suggestion_votes_tenant_idx on suggestion_votes (tenant_id);

create or replace function bump_suggestion_vote_count() returns trigger as $$
begin
  if (TG_OP = 'INSERT') then
    update suggestions set vote_count = vote_count + 1 where id = NEW.suggestion_id;
  elsif (TG_OP = 'DELETE') then
    update suggestions set vote_count = greatest(0, vote_count - 1) where id = OLD.suggestion_id;
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists suggestion_vote_count_trigger on suggestion_votes;
create trigger suggestion_vote_count_trigger
after insert or delete on suggestion_votes
for each row execute function bump_suggestion_vote_count();

alter table suggestion_votes enable row level security;

drop policy if exists suggestion_votes_select on suggestion_votes;
drop policy if exists suggestion_votes_insert on suggestion_votes;

create policy suggestion_votes_select on suggestion_votes for select
  using (
    tenant_id = public.current_tenant_id()
    and (
      public.has_perm('vote.view_all')
      or voter = public.current_app_user_id()
      or voter = public.jwt_email()
    )
  );

create policy suggestion_votes_insert on suggestion_votes for insert
  with check (
    tenant_id = public.current_tenant_id()
    and (voter = public.current_app_user_id() or voter = public.jwt_email())
  );

create or replace function public.list_my_suggestion_votes()
returns table (suggestion_id uuid)
language sql stable security definer set search_path = public as $$
  select v.suggestion_id
  from suggestion_votes v
  where v.tenant_id = public.current_tenant_id()
    and (v.voter = public.current_app_user_id() or v.voter = public.jwt_email());
$$;

grant execute on function public.list_my_suggestion_votes() to anon, authenticated, service_role;
