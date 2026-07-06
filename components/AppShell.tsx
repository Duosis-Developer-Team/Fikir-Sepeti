"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNameContext } from "./NameGate";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { name } = useNameContext();

  if (pathname?.endsWith("/present") || pathname === "/") return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col">
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-[clamp(24px,5vw,56px)] py-[14px]"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "#181818" }}
      >
        <Link href="/" className="flex items-center gap-2.5">
          <span className="font-display grid h-[30px] w-[30px] place-items-center rounded-[9px] text-[1.05rem] font-extrabold" style={{ background: "linear-gradient(140deg,#F2795F,#E7A93F)", color: "#0F0F0F" }}>
            F
          </span>
          <span className="font-display text-[1.02rem] font-bold tracking-tight" style={{ color: "#EDEDED" }}>Fikir Sepeti</span>
        </Link>
        {name && (
          <Link href="/profil" className="flex items-center gap-[9px] rounded-full border border-transparent py-1 pl-1 pr-2 transition hover:border-[rgba(255,255,255,0.15)]">
            <span className="grid h-7 w-7 place-items-center rounded-full text-[0.78rem] font-bold" style={{ background: "linear-gradient(135deg,#E7A93F,#F2795F)", color: "#0F0F0F" }}>
              {name.charAt(0).toLocaleUpperCase("tr")}
            </span>
            <span className="text-[0.92rem]" style={{ color: "#C4C4C4" }}>{name}</span>
          </Link>
        )}
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
