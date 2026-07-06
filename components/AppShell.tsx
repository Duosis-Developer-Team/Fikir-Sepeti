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
        className="sticky top-0 z-20 flex items-center justify-between px-[clamp(24px,5vw,56px)] py-4"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "rgba(30,30,30,0.82)", backdropFilter: "blur(14px)" }}
      >
        <Link href="/" className="flex items-center gap-3">
          <span className="inline-flex h-[18px] items-end gap-[2px]">
            <span className="w-1 rounded-[1px]" style={{ height: 9, background: "#F2795F" }} />
            <span className="w-1 rounded-[1px]" style={{ height: 16, background: "#E7A93F" }} />
            <span className="w-1 rounded-[1px]" style={{ height: 12, background: "#33C293" }} />
          </span>
          <span className="text-[0.82rem] font-bold uppercase tracking-[0.22em]" style={{ color: "#EDEDED" }}>Fikir Sepeti</span>
        </Link>
        {name && (
          <div className="flex items-center gap-[9px]">
            <span className="grid h-7 w-7 place-items-center rounded-full text-[0.78rem] font-bold" style={{ background: "linear-gradient(135deg,#E7A93F,#F2795F)", color: "#161616" }}>
              {name.charAt(0).toLocaleUpperCase("tr")}
            </span>
            <span className="text-[0.92rem]" style={{ color: "#C4C4C4" }}>{name}</span>
          </div>
        )}
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
