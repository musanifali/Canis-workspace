import { createContext, useContext } from "react";
import type { BlockComponentRegistry, WorkspaceDataSource } from "../renderer/types";

/**
 * Everything WorkspaceRenderer needs, assembled once by WorkspaceProvider:
 * the registered block components and the data source (contracts + end-user
 * auth). The persistence store and validation context live in the separate
 * store context (card #15), also mounted by the provider.
 */
export interface WorkspaceConfig {
  components: BlockComponentRegistry;
  dataSource: WorkspaceDataSource;
  /** Platform API key; wires the Workspace Service client in Phase 4. */
  apiKey: string;
}

export const WorkspaceConfigContext = createContext<WorkspaceConfig | null>(null);

/** Read the provider config; throws if used outside a WorkspaceProvider. */
export function useWorkspaceConfig(): WorkspaceConfig {
  const config = useContext(WorkspaceConfigContext);
  if (!config) {
    throw new Error("useWorkspaceConfig must be used within a WorkspaceProvider.");
  }
  return config;
}
