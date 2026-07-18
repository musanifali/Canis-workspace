import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import "nextra-theme-docs/style.css";

export const metadata: Metadata = {
  title: { template: "%s — Canis", default: "Canis — Workspace Engine docs" },
  description:
    "Give your B2B app AI-built, contract-validated workspaces in an afternoon.",
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head />
      <body>
        <Layout
          navbar={
            <Navbar
              logo={
                <span style={{ fontWeight: 700, color: "#4f46e5" }}>
                  Canis{" "}
                  <span style={{ fontWeight: 400, color: "#6b7280" }}>docs</span>
                </span>
              }
            />
          }
          footer={<Footer>Canis — Workspace Engine</Footer>}
          pageMap={await getPageMap()}
          docsRepositoryBase="https://github.com/musanifali/Canis-workspace/tree/main/apps/docs"
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
