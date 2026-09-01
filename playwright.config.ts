import { defineConfig, devices } from "@playwright/test";
import { readFileSync, existsSync } from "node:fs";

/** Load .env.local into process.env for tests (without overriding existing). */
function loadEnvLocal() {
  const path = ".env.local";
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
loadEnvLocal();

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // `next start` "output: standalone" ile DESTEKLENMİYOR (Next uyarı veriyor).
    // Daha önemlisi: konteynerde çalışan şey `node server.js` — testler de tam
    // olarak o artefakta karşı koşmalı, yoksa "yerelde geçti, imajda patladı"
    // sınıfı hatalar teste hiç yakalanmaz. start:standalone, Dockerfile'ın
    // yaptığının aynısını yapıyor (static + public'i standalone'a kopyala).
    command: "npm run start:standalone",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      ...process.env,
      // NODE_OPTIONS TEMİZLENİYOR — bu şart.
      // `npm test` süreci --conditions=react-server ile koşuyor (lib/server/*
      // içindeki `server-only` guard'ı Next dışında fırlatıyor). Ama o koşul
      // alt sürece sızarsa standalone sunucu React'i "react-server" dalından
      // çözmeye çalışıp açılışta ölüyor. Test süreci ve uygulama sürecinin
      // farklı koşullara ihtiyacı var.
      NODE_OPTIONS: "",
      HOSTNAME: "127.0.0.1",
      PORT: String(PORT),
      NEXT_PUBLIC_AUTH_BYPASS: "1",
      // Uygulama RLS'e tabi rolle bağlanır; testlerin kurulum yaptığı
      // ADMIN_DATABASE_URL sunucuya VERİLMEZ — uygulama hiçbir zaman RLS'i
      // atlayan bir bağlantı görmemeli.
      DATABASE_URL: process.env.DATABASE_URL ?? "",
    },
  },
});
