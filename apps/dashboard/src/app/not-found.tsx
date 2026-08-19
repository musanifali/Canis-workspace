/**
 * Branded 404 (#96) — never the host's default error page.
 */
import Link from "next/link";
import type { ReactElement } from "react";

export const metadata = { title: "Not found — Canis" };

export default function NotFound(): ReactElement {
  return (
    <section className="error-page">
      <h1>404</h1>
      <p>That page doesn’t exist.</p>
      <p>
        <Link href="/">Back to the dashboard</Link>
      </p>
    </section>
  );
}
