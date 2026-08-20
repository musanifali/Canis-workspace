import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ticora Playground — type a sentence, get a validated workspace",
  description:
    "Watch a request become a contract-validated workspace — and watch the gate refuse exfil with a grounded reason. No signup.",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
