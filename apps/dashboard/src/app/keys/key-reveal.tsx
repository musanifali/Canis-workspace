"use client";

import { useEffect } from "react";
import { CopyButton } from "./copy-button";

/**
 * One-time reveal of a freshly minted/rotated key (#92 review). On mount it
 * clears the server-side cookie (fire-and-forget), so a refresh can't
 * re-display the credential — "shown exactly once" for real. The value is
 * already in this rendered page for the user to copy.
 */
export function KeyReveal({
  rawKey,
  name,
  scope,
  rotated,
}: {
  rawKey: string;
  name: string;
  scope: string;
  rotated: boolean;
}): React.ReactElement {
  useEffect(() => {
    // Clear the minted_key cookie the moment this renders.
    void fetch("/api/keys/dismiss", { method: "POST" }).catch(() => {});
  }, []);

  return (
    <div className="key-reveal">
      <p>
        <strong>
          {rotated ? "Rotated key" : "New key"} “{name}” ({scope}) — copy it now,
          it won’t be shown again.
        </strong>
      </p>
      <div className="key-reveal-row">
        <code>{rawKey}</code>
        <CopyButton value={rawKey} />
      </div>
    </div>
  );
}
