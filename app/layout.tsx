import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import NameGate from "@/components/NameGate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fikir Sepeti",
  description: "Fikir at, oyla veya kuraya bırak. İç hackathon için build modu dahil.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full">
        <NameGate>{children}</NameGate>
      </body>
    </html>
  );
}
