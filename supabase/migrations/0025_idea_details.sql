-- Hackathon fikir belirtme: başlık (text alanı zaten bu işi görüyor), açıklama
-- ve dosya eki. Dosya baytları ayrı tabloda tutulur ki `ideas` üzerindeki
-- normal `select *` (liste ekranları) her seferinde binary veri taşımasın —
-- dosya sadece biri "aç"a tıklayınca ayrı bir istekle çekilir.

alter table ideas add column if not exists description text;

create table if not exists idea_attachments (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references ideas(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  filename text not null,
  mime_type text not null,
  size_bytes int not null,
  data bytea not null,
  uploaded_by text,
  created_at timestamptz default now()
);

create index if not exists idea_attachments_idea_idx on idea_attachments (idea_id);

alter table idea_attachments enable row level security;

drop policy if exists idea_attachments_select on idea_attachments;
drop policy if exists idea_attachments_insert on idea_attachments;
drop policy if exists idea_attachments_delete on idea_attachments;

create policy idea_attachments_select on idea_attachments for select
  using (tenant_id = public.current_tenant_id());
create policy idea_attachments_insert on idea_attachments for insert
  with check (tenant_id = public.current_tenant_id());
create policy idea_attachments_delete on idea_attachments for delete
  using (tenant_id = public.current_tenant_id());
