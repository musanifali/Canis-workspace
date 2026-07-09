import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import type { Filter } from "@workspace-engine/core";

/**
 * Runtime filter bus (card #39, for FilterBar). A FilterBar block writes filters
 * keyed by the target block ids it controls; each target block reads its active
 * filters and merges them into its query before execution. This is deliberately
 * tiny and out of band from the saved spec — runtime filtering never mutates the
 * stored workspace.
 */

const EMPTY: Filter[] = [];

interface FilterState {
  byBlock: Readonly<Record<string, Filter[]>>;
  setBlockFilters: (blockId: string, filters: Filter[]) => void;
}

const WorkspaceFilterContext = createContext<FilterState | null>(null);

export function WorkspaceFilterProvider({ children }: { children: ReactNode }): ReactElement {
  const [byBlock, setByBlock] = useState<Record<string, Filter[]>>({});

  const setBlockFilters = useCallback((blockId: string, filters: Filter[]) => {
    setByBlock((prev) => {
      if (filters.length === 0 && !(blockId in prev)) return prev;
      return { ...prev, [blockId]: filters };
    });
  }, []);

  const value = useMemo<FilterState>(() => ({ byBlock, setBlockFilters }), [byBlock, setBlockFilters]);
  return <WorkspaceFilterContext.Provider value={value}>{children}</WorkspaceFilterContext.Provider>;
}

/** Runtime filters currently applied to a target block (empty if none / no bus). */
export function useRuntimeFilters(blockId: string): Filter[] {
  return useContext(WorkspaceFilterContext)?.byBlock[blockId] ?? EMPTY;
}

/** For a FilterBar: set the runtime filters applied to one of its target blocks. */
export function useWorkspaceFilters(): {
  setBlockFilters: (blockId: string, filters: Filter[]) => void;
} {
  const ctx = useContext(WorkspaceFilterContext);
  return { setBlockFilters: ctx?.setBlockFilters ?? (() => {}) };
}
