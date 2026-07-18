"use client";

/**
 * Home: the saved analytics views, listed straight from the WorkspaceStore
 * port (#53) — the dashboard discovers its own screens the way any vendor app
 * discovers saved workspaces.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import type { WorkspaceSummary } from "@workspace-engine/client";
import { canisStore } from "@/lib/browser-client";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; views: WorkspaceSummary[] };

export default function HomePage(): React.ReactElement {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    canisStore
      .list()
      .then((views) => {
        if (!cancelled) setState({ status: "ready", views });
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setState({
            status: "error",
            message: error instanceof Error ? error.message : String(error),
          });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return <p className="notice">Loading saved views…</p>;
  }
  if (state.status === "error") {
    return (
      <div className="notice error">
        <p>Could not reach the Workspace Service: {state.message}</p>
        <p>
          Start it (<code>npm run dev -w @workspace-engine/api</code>), provision
          with <code>node scripts/seed-dashboard-tenant.mjs</code>, then seed the
          views with <code>npm run seed -w @workspace-engine/dashboard</code>.
        </p>
      </div>
    );
  }
  if (state.views.length === 0) {
    return (
      <div className="notice">
        <p>
          No saved views yet — run{" "}
          <code>npm run seed -w @workspace-engine/dashboard</code> to save the
          analytics workspaces into the service.
        </p>
      </div>
    );
  }
  return (
    <ul className="view-list">
      {state.views.map((view) => (
        <li key={view.id}>
          <Link href={`/w/${view.id}`} className="view-card">
            <h2>{view.title}</h2>
            <p>
              Saved workspace · updated{" "}
              {new Date(view.updatedAt).toLocaleString()}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
