import { BrandIcon } from "@/components/BrandIcon";

// Global route-loading ekranı (App Router Suspense fallback).
export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6 text-text">
      <div className="flex flex-col items-center gap-4">
        <BrandIcon size="lg" priority className="animate-pulse" />
        <p className="text-sm font-medium text-text-muted">Sepet hazırlanıyor…</p>
      </div>
    </main>
  );
}
