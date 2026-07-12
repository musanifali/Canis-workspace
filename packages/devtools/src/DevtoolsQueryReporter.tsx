"use client";

/**
 * Bridges the workspace's react-query cache into the devtools bus (card #44).
 *
 * Mounted INSIDE a WorkspaceProvider (which owns the query client), it watches
 * every `["workspace-block", …]` query and reports a `loading` event when a
 * fetch starts and a `success`/`error` event — with the final row count and the
 * client-observed duration — when it finishes. The renderer stays untouched; the
 * timeline is reconstructed purely from cache transitions.
 */
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { recordQuery } from "./bus";

interface WorkspaceQueryState {
  status: "pending" | "error" | "success";
  fetchStatus: "fetching" | "paused" | "idle";
  data?: unknown;
}

export function DevtoolsQueryReporter(): null {
  const client = useQueryClient();

  useEffect(() => {
    const cache = client.getQueryCache();
    const startedAt = new Map<string, number>();

    const parse = (queryKey: unknown) => {
      if (!Array.isArray(queryKey) || queryKey[0] !== "workspace-block") return null;
      return {
        blockId: String(queryKey[1] ?? "?"),
        entity: String(queryKey[2] ?? "?"),
        query: queryKey[3],
      };
    };

    const report = (query: { queryKey: unknown; queryHash: string; state: WorkspaceQueryState }) => {
      const parsed = parse(query.queryKey);
      if (!parsed) return;
      const { fetchStatus, status, data } = query.state;
      const rows = Array.isArray(data) ? data.length : null;

      if (fetchStatus === "fetching") {
        if (!startedAt.has(query.queryHash)) {
          startedAt.set(query.queryHash, performance.now());
          recordQuery({ ...parsed, status: "loading", rows: null, ms: null });
        }
        return;
      }
      // Settled.
      const start = startedAt.get(query.queryHash);
      if (start !== undefined) {
        startedAt.delete(query.queryHash);
        recordQuery({
          ...parsed,
          status: status === "error" ? "error" : "success",
          rows,
          ms: Math.round(performance.now() - start),
        });
      }
    };

    // Queries already resolved before the reporter mounted (e.g. cached).
    for (const query of cache.getAll()) {
      const parsed = parse(query.queryKey);
      if (parsed && query.state.fetchStatus !== "fetching") {
        const rows = Array.isArray(query.state.data) ? (query.state.data as unknown[]).length : null;
        if (rows !== null) recordQuery({ ...parsed, status: "success", rows, ms: null });
      }
    }

    return cache.subscribe((event) => {
      if (event.query) report(event.query as never);
    });
  }, [client]);

  return null;
}
