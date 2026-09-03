import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (name: string) =>
  readFileSync(join(process.cwd(), ".github/workflows", name), "utf8");

/**
 * Korunan garanti: PROD'a yalnızca CI'ı yeşil olan main kodu çıkabilir.
 *
 * Eskiden bunu `deploy.yml` (Vercel) üzerinden doğruluyorduk. Vercel kesildi;
 * prod zinciri artık CI → Build Images → Deploy (Kubernetes). Garanti aynı,
 * doğrulandığı yer değişti — zincirin ilk halkası imajı üretmeyi CI'ın
 * sonucuna bağlıyor, imaj üretilmeden deploy job'ı da koşmuyor.
 */
test.describe("ci gate", () => {
  test("imaj üretimi yeşil CI'a bağlı", () => {
    const yml = read("build-images.yml");
    expect(yml).toContain("workflow_run");
    expect(yml).toContain('workflows: ["CI"]');
    expect(yml).toContain("branches: [main]");
    expect(yml).toContain("conclusion == 'success'");
    // Koşulsuz `push: branches: [main]` ile tetiklenmemeli — CI'ı atlardı.
    expect(yml).not.toMatch(/on:\s*\n\s*push:\s*\n\s*branches:\s*\[main\]/);
  });

  test("deploy yalnızca imaj üretiminden sonra koşar", () => {
    const yml = read("build-images.yml");
    // deploy job'ı build-push'a bağlı: imaj yoksa deploy yok.
    expect(yml).toMatch(/deploy:\s*\n\s*needs:\s*build-push/);
    expect(yml).toContain("uses: ./.github/workflows/deploy-k8s.yml");
  });

  test("deploy-k8s yalnızca fikirsepeti-prod'a dokunur", () => {
    const yml = read("deploy-k8s.yml");
    expect(yml).toContain("NAMESPACE: fikirsepeti-prod");
    // Namespace guard'ı: başka bir namespace'e deploy denemesi durur.
    expect(yml).toContain('if [[ "$NAMESPACE" != "fikirsepeti-prod" ]]');
    // PVC silme HİÇBİR koşulda olmamalı — local-path reclaimPolicy=Delete.
    expect(yml).not.toMatch(/delete\s+(pvc|persistentvolumeclaim)/i);
  });
});
