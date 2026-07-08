import {
  createContext,
  useContext,
  useMemo,
  type ReactElement,
  type ReactNode,
} from "react";
import type { ValidationContext } from "@workspace-engine/core";
import type { WorkspaceStore } from "./store";

interface WorkspaceStoreContextValue {
  store: WorkspaceStore;
  /** Contracts/registry/policy used to validate drafts on save. Optional. */
  validation?: ValidationContext | undefined;
}

const WorkspaceStoreContext = createContext<WorkspaceStoreContextValue | null>(
  null,
);

export interface WorkspaceStoreProviderProps {
  store: WorkspaceStore;
  validation?: ValidationContext | undefined;
  children: ReactNode;
}

/**
 * Supplies the persistence store (and optional validation context) to the
 * headless workspace hooks. This is the minimal wiring for the hooks; the full
 * WorkspaceProvider (card #16) composes this with the query client and block
 * registry. A QueryClient provider must also be present — the hooks run their
 * async work through React Query (see WorkspaceQueryClientProvider).
 */
export function WorkspaceStoreProvider({
  store,
  validation,
  children,
}: WorkspaceStoreProviderProps): ReactElement {
  const value = useMemo<WorkspaceStoreContextValue>(
    () => ({ store, validation }),
    [store, validation],
  );
  return (
    <WorkspaceStoreContext.Provider value={value}>
      {children}
    </WorkspaceStoreContext.Provider>
  );
}

function useStoreContext(): WorkspaceStoreContextValue {
  const value = useContext(WorkspaceStoreContext);
  if (!value) {
    throw new Error(
      "useWorkspace* hooks must be used within a WorkspaceStoreProvider (or WorkspaceProvider).",
    );
  }
  return value;
}

export function useWorkspaceStore(): WorkspaceStore {
  return useStoreContext().store;
}

export function useWorkspaceValidationContext(): ValidationContext | undefined {
  return useStoreContext().validation;
}
