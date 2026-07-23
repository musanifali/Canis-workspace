"use client";

import { useState } from "react";

/** Copy-to-clipboard button for the one-time raw-key reveal (#92). */
export function CopyButton({ value }: { value: string }): React.ReactElement {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="copy-btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard blocked (insecure context) — the key is visible to select.
        }
      }}
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}
