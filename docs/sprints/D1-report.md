## D1 — Production yayın · DEVAM (kod hazır, prod migration + doğrulama bekliyor)

**Tarih:** 2026-07-15  
**Branş:** `development` → `main`

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
- **Fix:** `window.location.href = "/"` → `window.location.assign("/")` (davranış aynı: tam
  reload + history girişi; React Compiler immutability kuralını tetiklemez).
- Prod migration paketi hazırlandı: `docs/sprints/D1-prod-migration.sql` (0006→0009, idempotent,
  tek kopyala-yapıştır bloğu; `duosis.com` domain kaydı 0007 içinde).
- Sprint dokümanları SaaS kapsamıyla güncellendi (D1 + SG1–SG3): Sprint-Plani, Sprint-Yonetimi,
  Proje-Plani (`tenants.plan/status`, `tenant_domains`, bireysel tenant, `platform.manage_tenants`).

### Kapı sonucu (yerelde, CI birebir)
- lint: ✅ 0 error (15 warning — hepsi önceden var, exit 0)
- build: ✅ `next build` başarılı
- test: ✅ **52 geçti / 0 kaldı** (`supabase db reset` → 0001–0009 + seed sonrası)
- `ci-gate.spec.ts` ✅ deploy'un CI'a bağlı olduğunu doğruluyor

### Regresyon
S1–S7 + login + RLS izolasyon testleri ✅

### Sapmalar
- Deploy "yeşil" sanılıyordu; gerçekte CI lint fail → deploy skipped. D1'in asıl işi bu blokajı
  açmaktı. Kod tarafı tamam; prod DB migration'ı ve canlı login doğrulaması kullanıcı elinde.

### Kullanıcı aksiyonu (prod'u canlıya almak için)
1. `main` push sonrası GitHub Actions: **CI → Deploy (production)** zincirinin yeşil olduğunu gör.
2. Supabase Dashboard → SQL Editor'da `docs/sprints/D1-prod-migration.sql` içeriğini çalıştır.
3. `https://fikir-sepeti-duosis.vercel.app/login` → Microsoft ile `@duosis.com` girişi;
   "tanımsız tenant" reddi kaybolmalı, kavanoz/arşiv/hackathon açılmalı.

### Sonraki
SG1 — Landing + giriş noktaları (D1 canlı doğrulandıktan sonra, `sprint/SG1-landing`).
