import { useQuery } from "@tanstack/react-query";
import { useWorkspaceStore } from "./context";
import type { WorkspaceSummary } from "./store";

export const WORKSPACE_LIST_KEY = ["workspace-list"] as const;

export interface WorkspaceListState {
  items: WorkspaceSummary[];
  status: "loading" | "error" | "success";
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * List saved workspaces (the "list" flow). Headless: returns data + state, no
 * UI. Shares the internal query cache with useWorkspace and the editor's save,
 * so a save invalidates and refreshes this list automatically.
 */
export function useWorkspaceList(): WorkspaceListState {
  const store = useWorkspaceStore();
  const query = useQuery<WorkspaceSummary[], Error>({
    queryKey: WORKSPACE_LIST_KEY,
    queryFn: () => store.list(),
  });

  return {
    items: query.data ?? [],
    status: query.isPending ? "loading" : query.isError ? "error" : "success",
    isLoading: query.isPending,
    error: query.error ?? null,
    refetch: () => {
      void query.refetch();
    },
  };
}
