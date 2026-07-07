"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNameContext } from "./AuthGate";
import { ThemeToggle } from "./ThemeToggle";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { name } = useNameContext();

  if (pathname?.endsWith("/present") || pathname === "/") return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col">
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-[clamp(24px,5vw,56px)] py-[14px]"
        style={{ borderBottom: "1px solid rgba(var(--border-rgb),0.08)", background: "var(--bg)" }}
      >
        <Link href="/" className="flex shrink-0 items-center" aria-label="FikirSepeti ana sayfa">
          {/* Desktop: yatay logo (tema-duyarlı) · Mobil: kare icon */}
          <Image
            src="/brand/fikirsepeti-logo.png"
            alt="FikirSepeti"
            width={958}
            height={220}
            priority
            className="fs-logo fs-logo--dark h-9 w-auto object-contain"
          />
          <Image
            src="/brand/fikirsepeti-logo-light.png"
            alt="FikirSepeti"
            width={947}
            height={220}
            priority
            className="fs-logo fs-logo--light h-9 w-auto object-contain"
          />
          <Image
            src="/brand/fikirsepeti-icon.png"
            alt="FikirSepeti"
            width={512}
            height={512}
            priority
            className="fs-logo-icon h-9 w-9 object-contain"
          />
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {name && (
            <Link href="/profil" className="flex items-center gap-[9px] rounded-full border border-transparent py-1 pl-1 pr-2 transition hover:border-[rgba(var(--border-rgb),0.15)]">
              <span className="grid h-7 w-7 place-items-center rounded-full text-[0.78rem] font-bold" style={{ background: "linear-gradient(135deg,#E7A93F,#F2795F)", color: "#0F0F0F" }}>
                {name.charAt(0).toLocaleUpperCase("tr")}
              </span>
              <span className="text-[0.92rem]" style={{ color: "var(--text-2)" }}>{name}</span>
            </Link>
          )}
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
