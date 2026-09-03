import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

// NOTE: ticora.vercel.app belongs to an unrelated project — Vercel gave us
// the -chi suffix. Getting this wrong points our canonical + og:image at
// someone else's domain. Update when a real domain is registered.
const SITE = "https://ticora-chi.vercel.app";
const TITLE = "Ticora — generative UI that can only build what your contract allows";
const DESC =
  "Your users describe a screen; Ticora turns it into a workspace your data contract already allows — and refuses, with a reason, when it doesn't.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: TITLE,
  description: DESC,
  openGraph: {
    type: "website",
    url: SITE,
    siteName: "Ticora",
    title: TITLE,
    description: DESC,
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: "#07070b", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Reveal-on-scroll is an enhancement. Without JS (or for a crawler
            that doesn't run it) the content must still be visible — otherwise
            the whole page is opacity:0 to anything that can't run our observer. */}
        <noscript>
          <style>{`.reveal{opacity:1 !important;transform:none !important}`}</style>
        </noscript>
      </head>
      <body>{children}</body>
    </html>
  );
}
