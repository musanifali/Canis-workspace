"use client";

/**
 * The 3-step vendor integration, verbatim from the docs (#53): contracts +
 * blocks + provider, then WorkspaceRenderer for whatever spec the store
 * returns. Nothing here imports package internals — if this file needs more
 * than the public surface, that's a paper-cut to log, not a hole to punch.
 */
import { useEffect, useMemo, useState } from "react";
import {
  WorkspaceProvider,
  WorkspaceRenderer,
} from "@workspace-engine/react";
import type { WorkspaceRecord } from "@workspace-engine/client";
import { defaultBlocks } from "@workspace-engine/ui";
import { createCanisContracts } from "@/canis/contracts";
import { canisClient, canisStore } from "@/lib/browser-client";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; record: WorkspaceRecord };

export function WorkspaceView({ id }: { id: string }): React.ReactElement {
  const contracts = useMemo(() => createCanisContracts(canisClient), []);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    canisStore
      .get(id)
      .then((record) => {
        if (!cancelled) setState({ status: "ready", record });
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
  }, [id]);

  if (state.status === "loading") {
    return <p className="notice">Loading view…</p>;
  }
  if (state.status === "error") {
    return <p className="notice error">Could not load the view: {state.message}</p>;
  }
  return (
    <WorkspaceProvider
      apiKey="injected-by-proxy"
      contracts={contracts}
      blocks={defaultBlocks}
      store={canisStore}
    >
      <h1 style={{ margin: "0 0 1rem", fontSize: "1.25rem" }}>
        {state.record.title}
      </h1>
      <WorkspaceRenderer spec={state.record.spec} />
    </WorkspaceProvider>
  );
}
