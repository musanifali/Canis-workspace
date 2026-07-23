import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { getSession } from "@/lib/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "Canis — Vendor Dashboard",
  description:
    "Contracts, audit, and usage analytics — rendered by Canis's own SDK.",
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}): Promise<React.ReactElement> {
  const session = await getSession();
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link href="/" className="brand">
            Canis <span className="brand-sub">vendor dashboard</span>
          </Link>
          {session ? (
            <nav>
              <Link href="/">Views</Link>
              <Link href="/contracts">Contracts</Link>
              <Link href="/telemetry">Telemetry</Link>
              {session.role === "owner" ? (
                <Link href="/members">Members</Link>
              ) : null}
              <span className="nav-user">{session.name ?? session.email ?? "signed in"}</span>
              <form method="POST" action="/api/auth/logout" className="nav-logout">
                <button type="submit">Log out</button>
              </form>
            </nav>
          ) : null}
        </header>
        <main className="site-main">{children}</main>
      </body>
    </html>
  );
}
