## SG1 — Landing + giriş noktaları · GEÇTİ (CI auth E2E beklenir)

**Tarih:** 2026-07-16  
**Branş:** `sprint/SG1-landing`

**Yapıldı:**
- Oturumsuz `/` → `LandingPage` (hero “Fikirden prototipe.”, üç katman kartı, Giriş/Kayıt)
- `AuthGate` public path: `/`, `/login`, `/register` (`lib/public-paths.ts`)
- `/register` stub (SG2 self-serve için rota hazır; 404 yok)
- Oturumlu `/` → mevcut uygulama ana ekranı
- D1 prod: MCP ile 0002–0009 (rapor: `D1-report.md`)

**Kapı sonucu:**
- lint: ✅ 0 error
- build: ✅
- test (yerel, Docker yok):
  - `unit-public-paths` ✅
  - SG1 oturumsuz landing + nav ✅
  - login “/ shows landing” ✅
  - authenticated home ❌ (local Supabase `127.0.0.1:54321` kapalı — `loginAs` seed’e bağlanamıyor)
- Beklenen: CI’da `supabase start` + seed ile authenticated E2E yeşil

**Regresyon:** login redirect davranışı bilinçli değişti (`/` artık landing). `tests/login.spec.ts` güncellendi.

**Sapmalar:** `/register` tam form değil — SG2 kapsamı; stub + CTA yeterli.

**Duo'ya soru:** yok

**Sonraki:** SG2 — Kayıt + self-serve tenant
