# S8 — Analitik huni

**Durum:** ✅ kod geçti (Duo ürün kapısı ayrı)
**Tarih:** 2026-07-16
**Branch:** `sprint/S8-analitik`

## Kapsam

1. Migration `0013_analytics.sql` — `baskets.production_note`, `effort_estimate`
2. Pure helpers `lib/analytics.ts` — huni oranları + 3. ay retention
3. `GET /api/analytics` teaser; `?full=1` → `analytics.view` yoksa **403**
4. `PATCH /api/analytics/production` — not/efor güncelleme
5. `/analytics` UI — teaser, huni, retention, üretime alınanlar
6. ProductionStage — kapatmadan önce not + efor
7. Nav: Ana sayfa → Analitik

## Test

- `tests/unit/analytics.spec.ts`
- `tests/s8-analytics.spec.ts` (teaser, 403, funnel, efor, izolasyon, UI)

## Duo kapısı

Ürün ekranı müşteriye açılabilir mi? — inceleme bekliyor.
