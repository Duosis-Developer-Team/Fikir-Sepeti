"use client";

import { useEffect } from "react";
import { BrandIcon } from "@/components/BrandIcon";

// Presenter ekranı çöktüğünde tüm app değil sadece bu route düşsün (canlı demo sırasında kritik).
export default function PresenterError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="presenter-stage flex h-screen items-center justify-center px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <BrandIcon size="lg" className="opacity-70" />
        <p className="text-[1.1rem] font-semibold" style={{ color: "#F4F1EA" }}>
          Sahne ekranında bir sorun oluştu
        </p>
        <button
          type="button"
          onClick={reset}
          className="rounded-full px-6 py-2.5 text-[0.95rem] font-semibold transition hover:opacity-90"
          style={{ background: "#E7A93F", color: "#17150F" }}
        >
          Tekrar dene
        </button>
      </div>
    </main>
  );
}
