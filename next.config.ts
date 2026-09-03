import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Konteyner için: .next/standalone altında kendi sunucusunu ve YALNIZCA
  // izlenen bağımlılıkları üretir (node_modules'ün tamamı imaja girmiyor).
  output: "standalone",
  // Kök AÇIKÇA veriliyor. Next aksi halde kökü yukarıdaki dizinlerden tahmin
  // ediyor; bu depo bir git worktree'sinde durduğu için tahmin
  // `.next/standalone/Fikir-Sepeti/worktrees/k8s/server.js` gibi iç içe bir
  // yol üretti. Docker'da bağlam farklı olduğu için orada tesadüfen doğru
  // çalışırdı — yani hata yerelde görünmeyip yalnızca imajda ortaya çıkardı.
  //
  // process.cwd() kullanılıyor, import.meta.url DEĞİL: Next bu dosyayı CJS'e
  // derliyor ve import.meta orada "exports is not defined" ile patlıyor.
  // `next build` her zaman proje kökünden koşuyor (npm script / Docker WORKDIR).
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
