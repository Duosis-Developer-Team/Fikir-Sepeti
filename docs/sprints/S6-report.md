## S6 — İmza an: çekiliş + dağıtım · GEÇTİ

**Tarih:** 2026-07-15  
**Branş:** `sprint/S6-imza-an`

**Yapıldı:**
- Paylaşılan `RaffleRevealStage` (shuffle → reveal + confetti + Atla + reduced-motion)
- Sosyal `RaffleReveal` sahneyi paylaşır; IdeaStage `poolSelect:random` çıplak Math.random persist kaldırıldı
- `ideaCount` / `ideaAssignment` (same|cross|manual) / `revealAnimation` Lobby + config
- Migration `0008`: `teams.idea_id`, `teams.angle`
- Cross dağıtım kura sahnesi; sonuç/demo takım↔fikir gösterir
- `lib/assignment.ts` saf yardımcılar

**Kapı sonucu:**
- lint/build: ✅ / test: 47 geçti, 0 kaldı
- `tests/s6-raffle.spec.ts`: stage + skip; cross result mapping; revealAnimation=false
- `tests/unit/assignment.spec.ts`
- S0 smoke (ideaCount:1 + same): ✅

**Regresyon:** önceki sprintler ✅

**Sapmalar:** Cross E2E canlı UI kura adımı yerine sonuç sayfasında eşleşme doğrulandı (revealAnimation:false + seed pairs); animasyon IdeaStage skip testinde kapsandı.

**Duo'ya soru:** yok

**Sonraki:** S7 — Puanlama (rubrik + jüri)
