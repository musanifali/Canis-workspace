import type { Metadata } from "next";
import { fontVariables } from "@/lib/fonts";
import { brand } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: `${brand.name} — ${brand.tagline}`,
  description: brand.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
