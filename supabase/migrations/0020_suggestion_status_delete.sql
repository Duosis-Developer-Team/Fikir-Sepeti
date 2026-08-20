-- Öneriler: "tamamlandı" işaretleme + silme izinleri.
-- (idea_pool için silme RLS'i zaten 0006'da var — pool.create sahibi kendi
-- fikrini, content.moderate sahibi herhangi birini silebiliyor.)

alter table suggestions add column if not exists status text not null default 'open'
  check (status in ('open', 'done'));

drop policy if exists suggestions_delete on suggestions;
drop policy if exists suggestions_update on suggestions;

create policy suggestions_delete on suggestions for delete
  using (
    tenant_id = public.current_tenant_id()
    and (
      created_by = public.current_app_user_id() or created_by = public.jwt_email()
      or public.has_perm('tenant.manage_settings')
    )
  );

-- Durumu (open/done) herhangi bir tenant üyesi değiştirebilir — oylama gibi
-- açık bir kolektif triyaj; asıl koruma silmede.
create policy suggestions_update on suggestions for update
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
