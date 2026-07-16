## SG2 — Kayıt + self-serve tenant · GEÇTİ

**Tarih:** 2026-07-16  
**Branş:** `sprint/SG2-register`

**Yapıldı:**
- Migration `0010_self_serve_tenant`: `tenants.plan/status`, `tenant_invites`,
  `create_tenant_for_user`, `join_tenant_by_invite`, `create_tenant_invite`,
  `peek_tenant_for_email`; `resolve_tenant_for_claims` → membership + suspended filter
- `/register`: e-posta+şifre, domain eşleşmesi, çalışma alanı oluştur, davet kodu
- AuthGate: `needsWorkspace` onboarding (oturum var, tenant yok → `/register`)
- Tenant Roller: davet kodu üretimi
- Prod MCP: `0010` uygulandı ve doğrulandı

**Kapı sonucu:**
- lint: ✅ 0 error
- build: ✅
- birim: `unit-register` ✅
- E2E SG2: CI’da (yerel Docker/Supabase yok)

**Regresyon:** bilinmeyen domain login → artık `/register` onboarding (`login.spec` güncellendi)

**Sapmalar:** yok

**Duo'ya soru:** yok

**Sonraki:** SG3 — Platform yönetim paneli
