## S4 — Kavanoz (Fikir Deposu) + üç tab · GEÇTİ

**Yapıldı:** `--clay` aksanı; `0006_idea_pool` + RLS + realtime; pool API (create/vote/promote/return/mark-winner); `useRealtimePool`; ana sayfa üç tab (Kavanoz · Hackathon · Etkinlik); poll + seçenek ekleme; promote → `ideaSource: 'repo'`; kaybeden → Kavanoza at; Lobby Kavanoz kaynağı
**Kapı sonucu:**
  - lint: ⚠️ mevcut set-state-in-effect uyarıları (S0/S3 deseni) / build: ✅ / test: 28 geçti, 0 kaldı
  - E2E kavanoz create+vote: ✅ tests/pool-kavanoz.spec.ts
  - E2E poll + ikinci kullanıcı seçenek: ✅
  - E2E promote → resolve → winner etiketi + return: ✅
  - Hızlı yol (Yeni sepet modal): ✅ + S0 smoke ✅
  - API `pool.promote` member=403 / organizer=200: ✅ tests/pool-api.spec.ts
  - S0–S3 regresyon: ✅
**Regresyon:** smoke + RBAC + RLS + tenant ✅
**Sapmalar:** Basket detay `tenantId` race → "Sepet bulunamadı" (düzeltildi). Smoke modal seçicileri home tab ile çakışıyordu (helpers `newBasketModal`).
**Duo'ya soru:** yok
**Sonraki:** S5 — Sonuç / Arşiv
