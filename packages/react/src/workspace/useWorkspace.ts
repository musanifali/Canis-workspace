import { useQuery } from "@tanstack/react-query";
import type { WorkspaceSpec } from "@workspace-engine/core";
import { useWorkspaceStore } from "./context";
import type { WorkspaceRecord } from "./store";

export function workspaceKey(id: string | undefined) {
  return ["workspace", id] as const;
}

export interface WorkspaceState {
  workspace: WorkspaceRecord | undefined;
  /** Convenience alias for workspace?.spec — feed this to WorkspaceRenderer. */
  spec: WorkspaceSpec | undefined;
  status: "idle" | "loading" | "error" | "success";
  isLoading: boolean;
  error: Error | null;
  /** Re-load the saved workspace (the "refresh" flow). */
  refetch: () => void;
}

/**
 * Load a single saved workspace by id (the "load"/"refresh" flow). Passing
 * `undefined` disables the query (status "idle") for not-yet-selected cases.
 * Block *data* refresh is separate — that's each block's own useBlockQuery.
 */
export function useWorkspace(id: string | undefined): WorkspaceState {
  const store = useWorkspaceStore();
  const enabled = id != null;
  const query = useQuery<WorkspaceRecord, Error>({
    queryKey: workspaceKey(id),
    queryFn: () => store.get(id as string),
    enabled,
  });

  const status: WorkspaceState["status"] = !enabled
    ? "idle"
    : query.isPending
      ? "loading"
      : query.isError
        ? "error"
        : "success";

  return {
    workspace: query.data,
    spec: query.data?.spec,
    status,
    isLoading: enabled && query.isPending,
    error: query.error ?? null,
    refetch: () => {
      void query.refetch();
    },
  };
}
