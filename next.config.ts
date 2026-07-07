import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Bu depoyu Turbopack kök dizini olarak sabitle. Aksi halde ana dizindeki
  // (~/package-lock.json gibi) başıboş lockfile'lar nedeniyle Next kökü yanlış
  // çıkarımlıyor ("inferred workspace root" uyarısı). Bkz. node_modules/next docs:
  // turbopack#root-directory
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
