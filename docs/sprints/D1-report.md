## D1 — Production yayın · GEÇTİ

**Tarih:** 2026-07-16  
**Branş:** `development` → `main` + prod Supabase MCP

### Kök neden (neden canlı güncellenmemişti)
`main` üzerindeki son commit (`a0dfe12`, S7) için **CI kırmızıydı** → Vercel deploy **atlandı**.
Deploy zinciri CI başarısına bağlı (`deploy.yml`: `workflow_run … conclusion == 'success'`),
bu yüzden hotfix + S4–S7 hiçbir zaman production'a çıkmadı. Son başarılı deploy `9c42439`
(2026-07-14) — yani prod eski koddaydı, login "tanımsız tenant" sorunu da bu yüzden sürüyordu.

CI'ın kırıldığı adım: **Lint**.
```
components/hackathon/stages/ProductionStage.tsx:36:5  error  react-hooks/immutability
window.location.href = "/";  →  "This value cannot be modified"
```

### Yapıldı
- **Fix:** `window.location.href = "/"` → `window.location.assign("/")`.
- Prod migration paketi: `docs/sprints/D1-prod-migration.sql` (0006→0009).
- **2026-07-16:** Prod Supabase MCP ile **0002→0009** uygulandı (prod S1 öncesi şemadaydı;
  yalnızca 0006–0009 yetmezdi). `tenant_domains` + `duosis.com` + RLS + idea_pool + scores.

### Kapı sonucu
- lint/build/test (kod tarafı, önceki): ✅
- Vercel production deploy: ✅ Ready (~19h önce); `GET /login` → 200, `GET /` → 200
- Prod DB assert (MCP):
  - `tenant_domains`: `duosis.com`, `duosis.dev` ✅
  - `resolve_tenant_for_claims('x@duosis.com')` → DuoSis UUID ✅
  - `idea_pool`, `scores` var; `baskets.tenant_id` NULL yok; RLS açık ✅

### Regresyon
S1–S7 + login + RLS izolasyon testleri (repo) ✅

### Sapmalar
- Plan “0006→0009” diyordu; prod’da tenants/RBAC/RLS hiç yoktu → **0002–0009** uygulandı.
- Canlı Azure `@duosis.com` tıklamalı OAuth smoke: şema/RPC hazır; oturum UI’si kullanıcıda doğrulanabilir.

### Sonraki
SG1 — Landing + giriş noktaları (`sprint/SG1-landing`).
