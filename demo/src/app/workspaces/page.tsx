"use client";

/**
 * Card #18 milestone: hand-written specs render live in the demo app. Mounts the
 * Workspace Engine once (contracts + blocks + provider) and renders any of three
 * hand-authored workspaces against the seeded case data — no LLM in the loop.
 */
import { useState } from "react";
import { WorkspaceProvider, WorkspaceRenderer } from "@workspace-engine/react";
import { contracts, blocks } from "@/workspace-engine/kit";
import { demoWorkspaces } from "@/workspace-engine/specs";

export default function WorkspacesPage() {
  const [activeId, setActiveId] = useState(demoWorkspaces[0]!.id);
  const active = demoWorkspaces.find((w) => w.id === activeId) ?? demoWorkspaces[0]!;

  return (
    <WorkspaceProvider apiKey="demo" userToken={{ demo: true }} contracts={contracts} blocks={blocks}>
      <main className="mx-auto max-w-6xl p-6" data-testid="workspaces-page">
        <h1 className="mb-1 text-xl font-semibold">Workspace Engine — live specs</h1>
        <p className="mb-4 text-sm text-black/50">
          Hand-written JSON specs rendered deterministically against the demo case contract.
        </p>

        <nav className="mb-5 flex gap-2" role="tablist">
          {demoWorkspaces.map((w) => (
            <button
              key={w.id}
              role="tab"
              aria-selected={w.id === activeId}
              data-testid={`tab-${w.id}`}
              onClick={() => setActiveId(w.id)}
              className={`rounded-full border px-3 py-1 text-sm ${
                w.id === activeId
                  ? "border-black bg-black text-white"
                  : "border-black/15 bg-white text-black/70"
              }`}
            >
              {w.label}
            </button>
          ))}
        </nav>

        <WorkspaceRenderer key={active.id} spec={active.spec} rowHeight={72} />
      </main>
    </WorkspaceProvider>
  );
}
