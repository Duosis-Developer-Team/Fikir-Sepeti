## Hotfix — CI SG2 known-domain membership · GEÇTİ

**Tarih:** 2026-07-16  
**Branş:** `fix/ci-sg2-register`

**Kök neden:** Domain eşleşen ilk girişte `ensureMembership` client upsert’i RLS’e takılıyordu
(`current_tenant_id()` için `app_users` şart → tavuk-yumurta). UI tenantId set ediyordu ama
`app_users` satırı yazılmıyordu → CI assert `undefined`.

**Yapıldı:**
- Migration `0012_ensure_membership` — `ensure_app_membership` security definer RPC
- AuthGate bu RPC’yi kullanıyor
- SG2 test: `ilike` + kısa poll
- Prod MCP: 0012 uygulandı; DuoSis kullanıcılarına `platform_owner` (admin paneli için)

**Sonraki:** CI yeşil → Vercel prod deploy → `/admin` canlı
