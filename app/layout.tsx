import type { Metadata } from "next";
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import AuthGate from "@/components/AuthGate";
import { AppShell } from "@/components/AppShell";

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const body = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Fikir Sepeti",
  description: "Fikir at, oyla veya kuraya bırak. İç hackathon için build modu dahil.",
  icons: {
    icon: [{ url: "/brand/fikirsepeti-icon.png", type: "image/png" }],
    shortcut: "/brand/fikirsepeti-icon.png",
    apple: "/brand/fikirsepeti-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={`${display.variable} ${body.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AuthGate>
          <AppShell>{children}</AppShell>
        </AuthGate>
      </body>
    </html>
  );
}
