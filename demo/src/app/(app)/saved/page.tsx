"use client";

/**
 * Saved workspaces (card #21) — the reload half of the round-trip. Lists the
 * specs saved from /create and renders the selected one through the SAME
 * deterministic read path as /workspaces (WorkspaceProvider + WorkspaceRenderer),
 * so a reloaded workspace is byte-identical to the one that was generated, with
 * live data. Persistence is localStorage, so this survives a full page reload.
 *
 * Demo Polish (#79): a friendly empty state + a demo-only "Load demo examples"
 * action so a cold machine can show the grid + reload story immediately.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  WorkspaceProvider,
  WorkspaceRenderer,
  type WorkspaceSummary,
  type WorkspaceRecord,
} from "@workspace-engine/react";
import { blocks } from "@/workspace-engine/kit";
import { useAnonymousUserKey } from "@/lib/use-anonymous-user-key";
import { useVendorDataAccess } from "@/workspace-engine/vendor-data";
import { createDemoWorkspaceStore } from "@/workspace-engine/workspace-store";
import { seedSavedWorkspaces } from "@/workspace-engine/seed-saved";

export default function SavedWorkspacesPage() {
  const userKey = useAnonymousUserKey();
  // Service mode → durable Postgres via /v1; otherwise localStorage.
  const store = useMemo(() => createDemoWorkspaceStore(userKey), [userKey]);
  // ADR-4: in service mode, contracts hit the vendor backend under the
  // end user's session token; the token IS the userToken passed below.
  const vendor = useVendorDataAccess(userKey);
  const [summaries, setSummaries] = useState<WorkspaceSummary[]>([]);
  const [active, setActive] = useState<WorkspaceRecord | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [seeding, setSeeding] = useState(false);

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
  const loadExamples = useCallback(async () => {
    setSeeding(true);
    try {
      await seedSavedWorkspaces(store);
      setReloadKey((k) => k + 1);
    } finally {
      setSeeding(false);
    }
  }, [store]);

  return (
    <main className="mx-auto max-w-6xl p-6" data-testid="saved-page">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-sentient text-2xl tracking-tight text-foreground">
            Saved workspaces
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Workspaces you saved from Create, reloaded with live data.
          </p>
        </div>
        {summaries.length > 0 && (
          <button
            type="button"
            onClick={loadExamples}
            disabled={seeding}
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-card disabled:opacity-50"
          >
            {seeding ? "Loading…" : "Load demo examples"}
          </button>
        )}
      </div>

      {summaries.length === 0 ? (
        <div
          data-testid="saved-empty"
          className="rounded-lg border border-border bg-card p-10 text-center"
        >
          <h2 className="font-sentient text-xl text-foreground">
            No saved workspaces yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Generate one on{" "}
            <Link href="/create" className="text-primary hover:underline">
              Create
            </Link>{" "}
            and press “Save workspace” — it’ll reload here with live data. Or
            load a few curated examples to see it right away.
          </p>
          <button
            type="button"
            onClick={loadExamples}
            disabled={seeding}
            data-testid="saved-seed"
            className="mt-5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:opacity-90 disabled:opacity-50"
          >
            {seeding ? "Loading…" : "Load demo examples"}
          </button>
        </div>
      ) : (
        <div className="flex gap-6">
          <ul className="w-64 shrink-0 space-y-1" data-testid="saved-list">
            {summaries.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => open(s.id)}
                  className={`flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-150 hover:bg-card ${
                    active?.id === s.id
                      ? "bg-card font-medium text-foreground"
                      : "text-muted-foreground"
                  }`}
                  title={s.title}
                >
                  {s.title}
                </button>
                <button
                  type="button"
                  onClick={() => remove(s.id)}
                  aria-label={`Delete ${s.title}`}
                  className="text-muted-foreground transition-colors hover:text-destructive"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          <div className="min-w-0 flex-1" data-testid="saved-render">
            {active && vendor.ready && (
              <WorkspaceProvider
                key={active.id}
                apiKey="demo"
                userToken={vendor.userToken}
                contracts={vendor.contracts}
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
