-- S8: analytics funnel — production metadata on baskets
alter table public.baskets
  add column if not exists production_note text;

alter table public.baskets
  add column if not exists effort_estimate numeric;
