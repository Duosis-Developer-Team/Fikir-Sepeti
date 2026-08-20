-- Production/Sonuçlar: efor tahmini yerine proje linki — kullanılabilir bir
-- artefakt (repo/deploy/Figma linki), sadece kolon ekler, hiçbir satırı değiştirmez.

alter table baskets add column if not exists project_link text;
