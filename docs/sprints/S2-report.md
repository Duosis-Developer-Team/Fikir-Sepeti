## S2 — RBAC: rol, izin, sunucu zorlama · GEÇTİ

**Yapıldı:** roles/role_permissions/user_roles, izin kataloğu, POST /api/baskets zorlama, tenant roller UI, jüri scope check API
**Kapı sonucu:**
  - lint: ✅ / build: ✅ / test: 16 geçti
  - member hackathon.create=403 ✅ tests/rbac-api.spec.ts
  - organizer=200 ✅
  - sepet-bazlı jury ✅
  - tenant admin roller sayfası ✅ /tenant/roles
**Regresyon:** S0–S1 ✅
**Sapmalar:** etkinlik oluşturma organizer yükseltmez (hackathon.create kaçınıldı)
**Duo'ya soru:** yok
**Sonraki:** S3 — RLS
