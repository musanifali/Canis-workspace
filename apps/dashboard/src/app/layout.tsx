import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Canis — Vendor Dashboard",
  description:
    "Contracts, audit, and usage analytics — rendered by Canis's own SDK.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link href="/" className="brand">
            Canis <span className="brand-sub">vendor dashboard</span>
          </Link>
          <nav>
            <Link href="/">Views</Link>
            <Link href="/contracts">Contracts</Link>
            <Link href="/telemetry">Telemetry</Link>
          </nav>
        </header>
        <main className="site-main">{children}</main>
      </body>
    </html>
  );
}
