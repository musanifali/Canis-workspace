"use client";

/**
 * devMode sandbox (card #40): a live, data-backed workspace with zero config —
 * no contracts, no blocks, no network. This whole page is three meaningful
 * lines; that's the <10-minute time-to-first-screen the card is about.
 */
import { WorkspaceSandbox } from "@workspace-engine/ui";

export default function SandboxPage() {
  return (
    <main className="mx-auto max-w-6xl p-6" data-testid="sandbox-page">
      <h1 className="mb-1 text-xl font-semibold">Workspace Engine — devMode sandbox</h1>
      <p className="mb-4 text-sm text-black/50">
        Rendered from <code>&lt;WorkspaceSandbox /&gt;</code> against a bundled sample contract. Check the
        console for the next step.
      </p>
      <WorkspaceSandbox />
    </main>
  );
}
