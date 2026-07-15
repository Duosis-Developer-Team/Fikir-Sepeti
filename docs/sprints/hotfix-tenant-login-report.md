## Hotfix — Tenant login + /login · GEÇTİ

**Tarih:** 2026-07-15  
**Branş:** `fix/tenant-login`

**Yapıldı:**
- `tenant_domains` tablosu + DuoSis için `duosis.com` domain kaydı (migration `0007`)
- `resolve_tenant_for_claims(email, azure_tid)` RPC — Azure tid önce, sonra domain
- Legacy `resolve_tenant_id_for_email` yeni RPC'ye wrap
- AuthGate redirect guard; ayrı `/login` sayfası; tenant reddi ekranı iyileştirildi
- Seed: `duosis.dev` + `duosis.com` + `other.com`

**Kapı sonucu:**
- lint: ✅ / build: ✅ / test: 40 geçti, 0 kaldı
- Yeni: `tests/login.spec.ts` (redirect, bilinen domain, bilinmeyen domain)
- Birim: multi-domain + `azureTenantIdFromUser` (`tests/unit-tenant.spec.ts`)

**Regresyon:** S0–S5 testleri ✅

**Sapmalar:** yok

**Duo'ya soru:** Production Supabase'e `0007` migration uygulanmalı + `development` → `main` merge için onay. Production login doğrulaması: `@duosis.com` Azure ile.

**Sonraki:** S6 — İmza an (onay sonrası / paralel development üzerinde)
