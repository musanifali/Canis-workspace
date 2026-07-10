"use client";

/**
 * Saved workspaces (card #21) — the reload half of the round-trip. Lists the
 * specs saved from /create and renders the selected one through the SAME
 * deterministic read path as /workspaces (WorkspaceProvider + WorkspaceRenderer),
 * so a reloaded workspace is byte-identical to the one that was generated, with
 * live data. Persistence is localStorage, so this survives a full page reload.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  WorkspaceProvider,
  WorkspaceRenderer,
  type WorkspaceSummary,
  type WorkspaceRecord,
} from "@workspace-engine/react";
import { blocks, contracts } from "@/workspace-engine/kit";
import { createLocalStorageWorkspaceStore } from "@/workspace-engine/workspace-store";

export default function SavedWorkspacesPage() {
  const store = useMemo(() => createLocalStorageWorkspaceStore(), []);
  const [summaries, setSummaries] = useState<WorkspaceSummary[]>([]);
  const [active, setActive] = useState<WorkspaceRecord | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Load the list on mount and after a delete; setState happens inside the async
  // IIFE (deferred, not synchronous in the effect body). Default to the newest.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await store.list();
      if (cancelled) return;
      setSummaries(list);
      const newest = list.length > 0 ? await store.get(list[0]!.id) : null;
      if (!cancelled) setActive(newest);
    })();
    return () => {
      cancelled = true;
    };
  }, [store, reloadKey]);

  const open = async (id: string) => setActive(await store.get(id));
  const remove = async (id: string) => {
    await store.remove(id);
    setReloadKey((k) => k + 1);
  };

  return (
    <main className="mx-auto max-w-6xl p-6" data-testid="saved-page">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Saved workspaces</h1>
        <Link href="/create" className="text-sm underline">
          ← Back to create
        </Link>
      </div>

      {summaries.length === 0 ? (
        <p data-testid="saved-empty" className="text-sm text-black/50">
          No saved workspaces yet. Generate one on{" "}
          <Link href="/create" className="underline">/create</Link> and press “Save workspace”.
        </p>
      ) : (
        <div className="flex gap-6">
          <ul className="w-64 shrink-0 space-y-1" data-testid="saved-list">
            {summaries.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => open(s.id)}
                  className={`flex-1 truncate rounded-md px-2 py-1 text-left text-sm hover:bg-black/5 ${
                    active?.id === s.id ? "bg-black/10 font-medium" : ""
                  }`}
                  title={s.title}
                >
                  {s.title}
                </button>
                <button
                  type="button"
                  onClick={() => remove(s.id)}
                  aria-label={`Delete ${s.title}`}
                  className="text-black/30 hover:text-red-600"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          <div className="min-w-0 flex-1" data-testid="saved-render">
            {active && (
              <WorkspaceProvider
                key={active.id}
                apiKey="demo"
                userToken={{ demo: true }}
                contracts={contracts}
                blocks={blocks}
              >
                <WorkspaceRenderer spec={active.spec} rowHeight={72} />
              </WorkspaceProvider>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
