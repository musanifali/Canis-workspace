// SERVER component (no "use client") — layouts, metadata, and data routes
// stay on the server. Nothing from @workspace-engine/react is imported here:
// the SDK is a client-side surface (contracts hold functions, the renderer
// uses state), so it lives behind the "use client" boundary in components/.
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Canis — Next.js App Router example",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
