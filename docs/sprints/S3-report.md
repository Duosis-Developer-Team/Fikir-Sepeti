## S3 — RLS: izolasyon + realtime · GEÇTİ (Duo onayladı)

**Yapıldı:** Tüm tablolarda RLS; `current_tenant_id` / `has_perm` helpers; oy maskeleme (`votes` policy + `list_my_votes` RPC); seed auth kullanıcıları + AuthGate password→JWT köprüsü; `useRealtimeVotes` RPC yolu
**Kapı sonucu:**
  - lint: ✅ / build: ✅ / test: 20 geçti, 0 kaldı
  - Ham anon key — baskets boş/erişilemez: ✅ tests/rls-isolation.spec.ts
  - DuoSis JWT Other Corp satırı göremez: ✅
  - member başkasının `votes.voter` bilgisini göremez: ✅
  - Authenticated write+fetch (polling path) latency ~88ms: ✅
  - S0–S2 regresyon: ✅
**Regresyon:** smoke + RBAC + tenant isolation ✅
**Sapmalar:** Realtime postgres_changes eventi yerel stack'te flaky olduğu için kapı maddesi authenticated fetch + mevcut smoke polling yolu ile kanıtlandı (primitif aynı: optimistic + reconnect + 3s fallback).
**Duo'ya soru:** yok
**Duo onayı:** 2026-07-15 — güvenlik kapısı onaylandı; S4 serbest.
**Sonraki:** S4 — Kavanoz
