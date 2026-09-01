# Fikir Sepeti — Kubernetes kurulumu

Vercel + Supabase yerine kendi kümemizde çalışan kurulum. Hermes ve LogiSlot
ile aynı desen: küme içi PostgreSQL (StatefulSet + local-path PVC), GHCR
imajı, migration Job'u, NodePort/ingress.

**Canlı:** https://fikirsepeti-84-247-180-173.sslip.io · namespace `fikirsepeti-prod`
(NodePort `http://84.247.180.172:30090` geri dönüş yolu olarak açık kalıyor)

---

## Mimari

```
Tarayıcı ──► node2:443 (TLS) ──► ingress-nginx ──► fikirsepeti-web (Next.js standalone, :3000)
         └─► NodePort 30090 (http, yedek) ──────►
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

| Secret | Ne için | Durum |
|---|---|---|
| `KUBE_CONFIG` | base64'lenmiş kubeconfig — **`fikirsepeti-deployer` SA'sı**, node1'in admin config'i DEĞİL (aşağı bak) | ✅ |
| `PROD_POSTGRES_PASSWORD` | Postgres sahip rolü | ✅ |
| `PROD_APP_DB_PASSWORD` | `fikirsepeti_app` rolü | ✅ |
| `PROD_AZURE_CLIENT_ID` / `PROD_AZURE_CLIENT_SECRET` | Microsoft girişi | ✅ |
| `GHCR_PULL_TOKEN` | `read:packages` PAT | **gerekmiyor** — `ghcr-pull` secret'ı namespace'te zaten var ve default SA'ya bağlı |

#### Deploy kimliği — neden admin kubeconfig değil

`KUBE_CONFIG` içindeki kimlik `k8s/rbac/deployer.yaml` ile tanımlı
`fikirsepeti-deployer` ServiceAccount'u ve yetkisi **yalnızca
`fikirsepeti-prod`**. node1'deki `/root/.kube/config` tüm kümeye cluster-admin
verir (Hermes, LogiSlot, Drake prod dahil); repo public ve main'e push
yetkisi olan birden fazla kişi var — Actions secret'ı log'da maskeli olsa da
bir workflow ekleyip dışarı taşımak kolay. Sızma durumunda bu SA başka bir
namespace'e dokunamaz.

`delete` yetkisi **yalnızca Job'larda** (tamamlanmış Job yeniden apply
edilemediği için şart). PVC delete bilinçli olarak verilmedi — local-path
reclaimPolicy=Delete, PVC silmek veriyi siler.

Kimlik deploy'un ön koşulu olduğu için overlay'e dahil değil, elle uygulanır:

```bash
kubectl apply -f k8s/rbac/deployer.yaml

# kubeconfig'i yeniden üretmek (token rotasyonu vb.)
TOKEN=$(kubectl -n fikirsepeti-prod get secret fikirsepeti-deployer-token \
  -o jsonpath='{.data.token}' | base64 -d)
CA=$(kubectl -n fikirsepeti-prod get secret fikirsepeti-deployer-token \
  -o jsonpath='{.data.ca\.crt}')
```

Doğrulaması (kubeconfig elinizdeyken):

```bash
kubectl auth can-i get pods -n fikirsepeti-prod        # yes
kubectl auth can-i get pods -n hermes-test             # no
kubectl auth can-i delete pvc -n fikirsepeti-prod      # no
kustomize build k8s/overlays/prod | kubectl diff -f -  # sapma var mı
```

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

1. Entra portalında uygulama kaydı aç. **Kayıt tek-kiracılı ("Yalnızca
   kuruluşum") ise `AZURE_TENANT_ID`'ye tenant GUID'i yazmak ŞART** —
   `organizations` / `common` uçları tek-kiracılı uygulamaları AADSTS50194 ile
   reddediyor. Mevcut kurulum tek-kiracılı: tenant `6d7f5e10-…-5ddab61689cf`.
2. Redirect URI (**Web** tipi):
   `https://fikirsepeti-84-247-180-173.sslip.io/api/auth/azure/callback`
   — `AZURE_REDIRECT_URI` ile **birebir** aynı olmak zorunda.
   **HTTPS şart:** Entra `http://localhost` dışında http redirect URI kabul
   etmiyor; NodePort adresi (`http://…:30090`) bu yüzden kaydedilemiyordu.
3. Client secret üret.
4. Token yapılandırmasında `email` claim'ini iste (yoksa
   `preferred_username`/`upn`'e düşülüyor ama garanti değil).
5. `PROD_AZURE_CLIENT_ID` / `PROD_AZURE_CLIENT_SECRET` secret'larını ekle,
   deploy et. **GitHub secret'ı olarak eklemek şart** — deploy workflow'u
   `fikirsepeti-secrets`'ı her koşuda yeniden yazıyor, yani kümedeki değeri
   elle set etmek bir sonraki deploy'da boşalır.

Yapılandırılmadığında `/api/auth/azure/start` **503** döner ve arayüz bunu
açıkça söyler; e-posta+şifre girişi etkilenmez.

**Kurulu (2026-09-01):** uygulama `Fikir Sepeti`, client
`b891cc0a-2aec-4ac3-b730-9a616e398074`, tek-kiracılı. `/api/auth/azure/start`
302 ile Microsoft giriş sayfasına gidiyor, AADSTS hatası yok. Client secret
GitHub secret'ında; süresi dolduğunda Entra'da yeni secret üretip
`PROD_AZURE_CLIENT_SECRET`'ı güncellemek ve deploy etmek yeterli (secret değeri
Entra'da yalnızca oluşturulurken bir kez gösteriliyor, sonradan okunamıyor).

---

## HTTPS / TLS sertifikası

**Kurulu ve çalışıyor** (2026-09-01). Adres:
`https://fikirsepeti-84-247-180-173.sslip.io` — Let's Encrypt, tarayıcının
güvendiği gerçek sertifika, self-signed değil.

Nasıl çalışıyor:

- **Host:** `sslip.io` gerçek bir public DNS servisi; `<ad>-84-247-180-173.sslip.io`
  doğrudan `84.247.180.173`'e (node2) çözülür. Domain satın almadan gerçek
  sertifika almanın yolu bu — Drake de aynı deseni kullanıyor
  (`drake-84-247-180-173.sslip.io`).
- **Neden node2:** `ingress-nginx` controller'ı (class `nginx`, tüm
  namespace'leri izler) node2'de **hostNetwork** ile çalışıyor ve 80/443'ü
  doğrudan dinliyor. node1'in 80/443'ü ise iptables ile `ingress-nginx-test`'e
  gidiyor ve o controller **yalnızca `hermes-test`'i** izliyor — oraya yazılan
  bir Ingress hiç görülmez. (LogiSlot bu tuzakta bir gün kaybetti.)
- **Sertifika:** cert-manager kümede kurulu, `letsencrypt-prod` ClusterIssuer
  Ready. `k8s/base/ingress.yaml`'daki `cert-manager.io/cluster-issuer`
  anotasyonu yeterli: Certificate → Order → HTTP-01 challenge → `fikirsepeti-tls`
  secret'ı otomatik doluyor, 60 günde bir kendi yeniliyor. Kurulumda ~40 saniye
  sürdü.
- **HTTP → HTTPS:** ingress TLS tanımlı olduğu için nginx `308` ile yönlendiriyor;
  HSTS başlığı da controller'dan geliyor.
- **Uygulama tarafı:** `isSecureRequest` `x-forwarded-proto`'yu okuduğu için
  oturum çerezleri HTTPS'te `Secure` bayrağıyla çıkıyor — ek ayar gerekmedi.

Durum kontrolü:

```bash
kubectl -n fikirsepeti-prod get certificate,order,challenge
echo | openssl s_client -connect fikirsepeti-84-247-180-173.sslip.io:443 \
  -servername fikirsepeti-84-247-180-173.sslip.io 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates
```

### Kendi alan adına geçmek

1. DNS: `fikirsepeti.duosis.com` → **A kaydı `84.247.180.173`** (node2!).
   Cloudflare'de **proxy KAPALI / gri bulut** — turuncu bulut HTTP-01
   doğrulamasını kırar (Cloudflare kendi sertifikasıyla araya girer).
2. `k8s/overlays/prod/ingress-patch.yaml` içindeki iki host satırı.
3. `k8s/overlays/prod/configmap-patch.yaml` → `AZURE_REDIRECT_URI`.
4. Entra uygulama kaydındaki redirect URI (birebir aynı olmalı).
5. `kubectl apply -k k8s/overlays/prod` + `rollout restart deploy/fikirsepeti-web`
   (ConfigMap değişikliği pod'u kendiliğinden yeniden başlatmaz).

Eski sertifika ismine bağlı, porta değil; NodePort erişimi bundan etkilenmiyor.

SSE için ingress annotation'ları hazır (`proxy-buffering: off`,
`proxy-read-timeout: 3600`) — bunlar olmadan nginx olayları tamponlar ve
"canlı" oylama canlı olmaz.

---

## Vercel'den kesme — TAMAMLANDI (2026-09-01)

Yapılanlar:

1. ✅ `deploy.yml` ve `sync-vercel-env.yml` silindi. **Sıra önemliydi:** main'e
   merge CI'ı yeşile çevirince `deploy.yml` Vercel'e prod deploy tetikleyecek
   ve çalışan Supabase'li sürümün üzerine çalışmayan bir build yazacaktı —
   yani geri dönüş yolunu yok edecekti. Workflow'lar merge'den ÖNCE kaldırıldı.
2. ✅ `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`,
   `SUPABASE_SERVICE_ROLE_KEY` GitHub secret'ları silindi. (Repo public;
   canlı bir Vercel token'ı orada durmamalıydı.)
3. ✅ Vercel projesi `fikir-sepeti-duosis` kaldırıldı,
   `fikir-sepeti-duosis.vercel.app` artık 404. **Dikkat:** `vercel remove
   <proje-adı>` yalnızca deployment'ları değil PROJENİN TAMAMINI siler
   (env değişkenleri ve deployment geçmişi dahil, geri alınamaz). Yalnızca
   deployment silmek isteniyorsa deployment URL'i tek tek verilmeli.
4. ⏳ **Supabase projesi hâlâ ayakta** — bilinçli. Uygulama ona hiç
   bağlanmıyor; panelden (Settings → General → Pause project) duraklatılabilir.
   Duraklatma geri dönüşümlü, silme değil.

Geri dönüş gerekirse: kod git'te, `supabase/migrations/` şemanın tek doğru
kaynağı olarak duruyor ve Supabase projesi yaşıyor — yeni bir Vercel projesi
bağlanıp `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
değerleri Supabase panelinden alınarak birkaç dakikada kurulur. Ama artık
istemci tarafı Supabase'den ayrıldığı için bu, merge öncesi bir commit'e
dönmek demektir.
