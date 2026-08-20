-- FS-17: demo/test verisini gerçek kullanımdan ayırt etmek için bayrak.
-- Sadece kolon ekler — hiçbir satırı değiştirmez veya silmez.

alter table baskets add column if not exists is_demo boolean not null default false;
