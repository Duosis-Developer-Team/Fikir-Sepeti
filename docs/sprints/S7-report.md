## S7 — Puanlama (rubrik + jüri) · GEÇTİ (Duo basitlik kapısı bekleniyor)

**Tarih:** 2026-07-15  
**Branş:** `sprint/S7-puanlama`

**Yapıldı:**
- Migration `0009_scores.sql` + realtime publication
- `lib/scoring.ts`: kategori kütüphanesi, DEFAULT_RUBRIC, weighted + jury hesap
- Lobide puanlama adımı: Basit oy (varsayılan) / Rubrik → “Varsayılan seti kabul et” (3 tık)
- DemoStage: `scoringMode:rubric` yıldız paneli + Scoreboard (kategori kırılımı)
- `scoringMode:simple` eski takım oyu korunur

**Kapı sonucu:**
- build: ✅ / test: 51 geçti (1 flaky retry OK)
- Birim: `tests/unit/scoring.spec.ts` (eşit yıldız, jüri ağırlığı, kategori weight)
- E2E: `tests/s7-scoring.spec.ts` (rubrik skorboard + simple regresyon)
- Smoke hackathon: Basit oy yolu yeşil

**Regresyon:** önceki sprintler ✅

**Sapmalar:** UI skorlarında `is_jury` şimdilik false (rol bağlama sonraki iyileştirme); jüri ağırlığı birim test + seed satırlarıyla doğrulandı.

**Duo'ya soru (basitlik kapısı):** Rubrik kurulum ekranı — “Varsayılan seti kabul et” ile ~3 tık. Karmaşıklaştı mı?

**Sonraki:** Onay sonrası S8 — Analitik huni
