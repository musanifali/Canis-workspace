"use client";

/**
 * Branded 500 (#96) — a client error boundary, never the host default page.
 * No error internals are shown to the user (they go to the server logs, #97).
 */
import type { ReactElement } from "react";

export default function Error({ reset }: { reset: () => void }): ReactElement {
  return (
    <section className="error-page">
      <h1>Something went wrong</h1>
      <p>We hit an unexpected error. Try again in a moment.</p>
      <button type="button" className="signup-submit" onClick={() => reset()}>
        Retry
      </button>
    </section>
  );
}
