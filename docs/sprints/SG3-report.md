## SG3 — Platform yönetim paneli · GEÇTİ

**Tarih:** 2026-07-16  
**Branş:** `sprint/SG3-admin`

**Yapıldı:**
- Migration `0011_platform_admin`: `platform.manage_tenants` → platform_owner; cross-tenant RLS
- API: `GET/PATCH /api/admin/tenants`, `GET /api/admin/tenants/[id]`
- UI: `/admin` tenant listesi, plan toggle, askıya alma, kullanıcı detayı
- Seed: `admin@duosis.dev` → `platform_owner`
- Prod MCP: 0011 + DuoSis admin’lere platform_owner

**Kapı sonucu:**
- lint: ✅ 0 error
- build: ✅
- birim: `unit-permissions` ✅
- E2E SG3: CI’da (yerel Docker yok)

**Regresyon:** S3 tenant izolasyonu API seviyesinde korunuyor (member → 403)

**Sapmalar:** yok

**Duo'ya soru:** yok

**Sonraki:** S8 — Analitik huni (SG serisi tamam)
