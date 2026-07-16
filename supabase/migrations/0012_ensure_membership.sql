-- Fix: first-time domain join must insert app_users without needing current_tenant_id()
-- (RLS chicken-and-egg). Idempotent.

create or replace function public.ensure_app_membership(p_email text, p_tenant_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_mem uuid;
  v_resolved uuid;
begin
  if length(v_email) < 3 or p_tenant_id is null then
    raise exception 'invalid args';
  end if;

  v_resolved := public.resolve_tenant_for_claims(v_email, null);
  if v_resolved is distinct from p_tenant_id then
    raise exception 'forbidden: email does not resolve to tenant';
  end if;

  insert into app_users (tenant_id, user_id, email, display_name)
  values (p_tenant_id, v_email, v_email, split_part(v_email, '@', 1))
  on conflict (tenant_id, user_id) do update
    set email = excluded.email;

  select id into v_mem from roles where key = 'member' and tenant_id is null limit 1;
  if v_mem is not null then
    insert into user_roles (tenant_id, user_id, role_id, scope_basket_id)
    select p_tenant_id, v_email, v_mem, null
    where not exists (
      select 1 from user_roles ur
      where ur.tenant_id = p_tenant_id
        and ur.user_id = v_email
        and ur.role_id = v_mem
        and ur.scope_basket_id is null
    );
  end if;

  return p_tenant_id;
end;
$$;

grant execute on function public.ensure_app_membership(text, uuid) to anon, authenticated, service_role;
