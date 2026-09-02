-- Rubrik puanlamayi (scores tablosu) juri iznine sahip olanlarla sinirla, ve
-- tenant_admin/platform_owner sistem rollerinin bu izni otomatik tasimasini kaldir.
--
-- Onceki durum: hackathon.jury tenant_admin + platform_owner'in role_permissions'ina
-- da eklenmisti (bkz. 0004_rbac.sql) — yani her admin/owner, o hackathon'a hic
-- atanmadan da "juri" sayiliyordu. Artik SADECE tenant/roller ekraninda "Jury"
-- rolu verilen kisiler puanlayabilir; admin roller kendiliginden juri olmaz.
--
-- scores_insert/scores_update politikalari da has_perm('hackathon.jury', basket_id)
-- kontrolu almadan sadece "kendi oyun" kontrolu yapiyordu — herkes (member dahil)
-- puan yazabiliyordu. RLS seviyesinde de kapatiyoruz (tek nokta kontrol ilkesi).

delete from role_permissions
where permission_key = 'hackathon.jury'
  and role_id in (
    select id from roles where tenant_id is null and key in ('tenant_admin', 'platform_owner')
  );

drop policy if exists scores_insert on scores;
create policy scores_insert on scores for insert
  with check (
    tenant_id = public.current_tenant_id()
    and (voter = public.current_app_user_id() or voter = public.jwt_email())
    and public.has_perm('hackathon.jury', basket_id)
  );

drop policy if exists scores_update on scores;
create policy scores_update on scores for update
  using (
    tenant_id = public.current_tenant_id()
    and (voter = public.current_app_user_id() or voter = public.jwt_email())
    and public.has_perm('hackathon.jury', basket_id)
  );
