# Fikir Sepeti — Next.js (standalone) + migration çalıştırıcısı tek imajda.
#
# TEK İMAJ, İKİ ROL: web Deployment'ı `node server.js` ile açılıyor, migration
# Job'u aynı imajı `node scripts/migrate.mjs` ile çalıştırıyor. Ayrı bir
# migration imajı, şema ile onu uygulayan kodun farklı sürümlere kaymasına
# izin verirdi; aynı imaj bunu yapısal olarak imkânsız kılıyor.

FROM node:22-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY . .
# Build sırasında veritabanına bağlanılmıyor ama lib/server/pg.ts import
# edilirken DATABASE_URL okunuyor; yer tutucu yeterli (çalışma zamanında
# secret'tan gerçek değer geliyor).
ENV DATABASE_URL=postgresql://placeholder@localhost:5432/placeholder
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
# GHCR paketini repoya BAĞLAR. Bu etiket olmadan Actions'ın GITHUB_TOKEN'ı
# pakete yazamıyor ("denied: permission_denied: write_package") — LogiSlot'ta
# deploy'un düşmesinin bir numaralı sebebi buydu.
LABEL org.opencontainers.image.source="https://github.com/Duosis-Developer-Team/Fikir-Sepeti"

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Standalone sunucu + statik varlıklar. public/ standalone'a otomatik
# kopyalanmıyor (marka görselleri, favicon oradan geliyor).
COPY --from=builder /repo/.next/standalone ./
COPY --from=builder /repo/.next/static ./.next/static
COPY --from=builder /repo/public ./public

# Migration çalıştırıcısı ve SQL'ler. `pg` zaten standalone'ın node_modules'ünde
# (uygulama kullanıyor), o yüzden ayrıca kurulmuyor.
COPY --from=builder /repo/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=builder /repo/db ./db
COPY --from=builder /repo/supabase/migrations ./supabase/migrations

# Root olmayan kullanıcı — node:alpine'da hazır gelen `node` kullanıcısı.
USER node

EXPOSE 3000
CMD ["node", "server.js"]
