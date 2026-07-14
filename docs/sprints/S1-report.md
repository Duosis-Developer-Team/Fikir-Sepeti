## S1 — Tenant modeli + veri taşıma · GEÇTİ

**Yapıldı:** tenants/app_users, tenant_id backfill (9 tablo), çözümleme (Azure→email domain), uygulama katmanı filtre, iki tenant seed
**Kapı sonucu:**
  - lint: ✅ / build: ✅ / test: 12 geçti, 0 kaldı
  - Kapı maddeleri:
    - migration idempotent: ✅ (db reset twice via migrations)
    - smoke regression: ✅
    - null tenant_id yok: ✅ tests/tenant-isolation.spec.ts
    - A görmez B sepetlerini: ✅ tests/tenant-isolation.spec.ts
**Regresyon:** S0 smoke ✅
**Sapmalar:** yok
**Duo'ya soru:** yok
**Sonraki:** S2 — RBAC
