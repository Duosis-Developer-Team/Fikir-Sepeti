## S0 — Test zemini + CI kapısı · GEÇTİ

**Yapıldı:** Playwright + local Supabase migrations + seed + etkinlik/hackathon smoke + ci.yml + deploy→CI bağımlılığı
**Kapı sonucu:**
  - lint: ✅ (0 error) / build: ✅ / test: 3 geçti, 0 kaldı
  - Kapı maddeleri:
    - lint+build: ✅
    - playwright smoke etkinlik: ✅ tests/smoke-etkinlik.spec.ts
    - playwright smoke hackathon: ✅ tests/smoke-hackathon.spec.ts
    - deploy CI bağlandı: ✅ tests/ci-gate.spec.ts + .github/workflows/deploy.yml
**Regresyon:** n/a (ilk sprint)
**Sapmalar:** set-state-in-effect [warn] (mevcut data-fetch desenleri); supabase start --ignore-health-check (pg_meta health flake)
**Duo'ya soru:** yok
**Sonraki:** S1 — Tenant modeli + veri taşıma
