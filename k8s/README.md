# Fikir Sepeti — Kubernetes kurulumu

Vercel + Supabase yerine kendi kümemizde çalışan kurulum. Hermes ve LogiSlot
ile aynı desen: küme içi PostgreSQL (StatefulSet + local-path PVC), GHCR
imajı, migration Job'u, NodePort/ingress.

**Canlı:** http://84.247.180.172:30090 · namespace `fikirsepeti-prod`

---

## Mimari

```
Tarayıcı ──► NodePort 30090 ──► fikirsepeti-web (Next.js standalone, :3000)
                                      │
                                      ├── /api/*        REST — tüm veri erişimi
                                      ├── /api/realtime SSE — LISTEN/NOTIFY köprüsü
                                      └── /api/auth/*   oturum + Azure OIDC
                                      │
                                      ▼  fikirsepeti_app rolü (RLS DEVREDE)
                              fikirsepeti-postgres:5432
                                      ▲
                                      │  fikirsepeti (sahip rolü, RLS atlanır)
                              migration Job (yalnızca deploy sırasında)
```

Supabase'in üç parçasının karşılığı:

| Supabase | Buradaki karşılığı |
|---|---|
| PostgREST (tarayıcı→DB) | `app/api/*` route handler'ları + `lib/server/pgrest.ts` |
| GoTrue (auth) | `lib/server/auth.ts` + `app/api/auth/*` (httpOnly çerez, scrypt, Azure OIDC) |
| Realtime (WebSocket) | `pg_notify` tetikleyicileri → tek `LISTEN` → SSE (`app/api/realtime`) |

---

## En önemli güvenlik kuralı: iki ayrı bağlantı

Bunları birleştirmeyin.

- **`DATABASE_URL`** → web pod'u. `fikirsepeti_app` rolü, tabloların sahibi
  **değil**, dolayısıyla **RLS ona uygulanır**. Kimlik her istekte transaction
  içinde `SET LOCAL app.user_email` ile veriliyor ve `auth.jwt()` shim'i onu
  okuyor (`db/compat/0000_supabase_compat.sql`).
- **`ADMIN_DATABASE_URL`** → **yalnızca** migration Job'u. Sahip rolü, RLS
  atlanır.

Web pod'una sahip rolünün kimlik bilgisi **verilmiyor** (`web-deployment.yaml`
secret'ın tamamını `envFrom` ile almıyor, alanları tek tek seçiyor). Böylece bir
uygulama açığı en kötü ihtimalle RLS'in izin verdiği kadarına ulaşabiliyor.

Doğrulaması: `npm run verify:db` (21 kontrol) ve `tests/rls-isolation.spec.ts`.

---

## Deploy

Otomatik: `main`'e push → **CI** → **Build Images** → **Deploy (Kubernetes)**.

Elle:

```bash
gh workflow run "Deploy (Kubernetes)" -f image_tag=prod-<sha7>
```

Elle, kümeden (kubeconfig node1'de hazır):

```bash
kubectl apply -k k8s/overlays/prod
kubectl -n fikirsepeti-prod rollout status statefulset/fikirsepeti-postgres

# migration — tamamlanmış bir Job yeniden apply edilemez, adı SHA'lı olmalı
JOB=fikirsepeti-migration-$(git rev-parse --short=7 HEAD)
sed "s|name: fikirsepeti-migration|name: $JOB|" k8s/base/migration-job.yaml \
  | kubectl -n fikirsepeti-prod apply -f -
kubectl -n fikirsepeti-prod logs -f job/$JOB

kubectl -n fikirsepeti-prod rollout status deploy/fikirsepeti-web
```

### Gereken GitHub secret'ları

| Secret | Ne için |
|---|---|
| `KUBE_CONFIG` | base64'lenmiş kubeconfig (node1'deki `/root/.kube/config`) |
| `PROD_POSTGRES_PASSWORD` | Postgres sahip rolü |
| `PROD_APP_DB_PASSWORD` | `fikirsepeti_app` rolü |
| `GHCR_PULL_TOKEN` | `read:packages` PAT — imaj private ise şart |
| `PROD_AZURE_CLIENT_ID` / `PROD_AZURE_CLIENT_SECRET` | Microsoft girişi (opsiyonel) |

Deploy workflow'u secret'ı her koşuda yeniden yazıyor; parolayı değiştirmek =
secret'ı güncelleyip deploy etmek (migration `fikirsepeti_app` rolünün
parolasını `APP_DB_PASSWORD`'dan senkronlar).

---

## Migration nasıl çalışıyor

`scripts/migrate.mjs` üç kaynağı **bu sırayla** uygular:

1. `db/compat/` — Supabase taklidi (`auth.jwt()`, `anon`/`authenticated`
   rolleri, `supabase_realtime` publication, uygulama rolü)
2. `supabase/migrations/` — **şemanın tek doğru kaynağı**, dosyalar
   değiştirilmeden çalışıyor
3. `db/migrations/` — self-host eklentileri (9xxx: kimlik tabloları, NOTIFY)

Ekip `supabase/migrations/` altına yeni migration eklemeye devam edebilir;
compat katmanı sayesinde burada da çalışırlar. Numaralandırma çakışmasın diye
self-host dosyaları 9000'den başlıyor.

Uygulanan her dosya `schema_migrations`'a adı + sha256'sıyla yazılıyor.
**Uygulanmış bir migration'ı düzenlemeyin** — çalıştırıcı checksum farkını
görüp durur (kasıtlıysa `ALLOW_CHECKSUM_DRIFT=1`).

---

## Yedekleme

> **UYARI:** `local-path` StorageClass'ın reclaimPolicy'si `Delete`.
> PVC'yi silmek **veriyi siler**. LogiSlot/Hermes'te de aynı risk var.

```bash
# yedek al
kubectl -n fikirsepeti-prod exec fikirsepeti-postgres-0 -c postgres -- \
  pg_dump -U fikirsepeti -d fikirsepeti --clean --if-exists \
  > fikirsepeti-$(date +%Y%m%d-%H%M).sql

# geri yükle
kubectl -n fikirsepeti-prod exec -i fikirsepeti-postgres-0 -c postgres -- \
  psql -U fikirsepeti -d fikirsepeti < yedek.sql
```

---

## Microsoft (Azure Entra) girişi

1. Entra portalında uygulama kaydı aç.
2. Redirect URI (**Web** tipi): `http://84.247.180.172:30090/api/auth/azure/callback`
   — domain bağlanınca bu da değişir ve `AZURE_REDIRECT_URI` ile **birebir**
   aynı olmak zorunda.
3. Client secret üret.
4. Token yapılandırmasında `email` claim'ini iste (yoksa
   `preferred_username`/`upn`'e düşülüyor ama garanti değil).
5. `PROD_AZURE_CLIENT_ID` / `PROD_AZURE_CLIENT_SECRET` secret'larını ekle,
   deploy et.

Yapılandırılmadığında `/api/auth/azure/start` **503** döner ve arayüz bunu
açıkça söyler; e-posta+şifre girişi etkilenmez.

---

## Domain bağlama (sonraki adım)

Şu an NodePort. Domain için:

1. `k8s/base/ingress.yaml` içindeki `REPLACE_HOST`'u gerçek host ile değiştirip
   overlay'e ekleyin (`kustomization.yaml` → `resources`).
2. **Ingress class `nginx` olmalı.** Kümede üç controller var; seçim kriteri
   class adı değil, controller'ın hangi namespace'leri izlediği:
   `ingress-nginx-test` node1'de 80/443'ü karşılıyor ama **yalnızca
   `hermes-test`'i izliyor** — buradaki bir Ingress'i asla görmez.
   (LogiSlot bu tuzağa düşüp bir gün kaybetti.)
3. `ingress-nginx`'in NodePort'ları 31412/30772; 80/443 Hermes'te. LogiSlot'un
   yaptığı gibi Cloudflare + origin portu (8443 → 30772) yönlendirmesi gerekir.
4. `AZURE_REDIRECT_URI`'yi ve Entra kaydındaki redirect URI'yi güncelleyin.

SSE için ingress annotation'ları hazır (`proxy-buffering: off`,
`proxy-read-timeout: 3600`) — bunlar olmadan nginx olayları tamponlar ve
"canlı" oylama canlı olmaz.

---

## Vercel'den kesme

Vercel workflow'ları (`deploy.yml`, `sync-vercel-env.yml`) **bilerek duruyor**
— kesme anına kadar geri dönüş yolu. Küme kurulumu onaylandığında:

1. `.github/workflows/deploy.yml` ve `sync-vercel-env.yml` silinir.
2. Vercel projesi (`fikir-sepeti-duosis`) durdurulur.
3. Supabase projesi durdurulur (veri yok, pilot açılmadı).
