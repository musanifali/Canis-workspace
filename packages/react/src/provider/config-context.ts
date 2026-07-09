import { createContext, useContext } from "react";
import type { ValidationContext } from "@workspace-engine/core";
import type { BlockComponentRegistry, WorkspaceDataSource } from "../renderer/types";
import type { OnBlockDegraded } from "../renderer/degradation";

/**
 * Everything WorkspaceRenderer needs, assembled once by WorkspaceProvider:
 * the registered block components, the data source (contracts + end-user auth),
 * the validation context (for read-time contract-drift detection), and the
 * degradation telemetry callback. The persistence store also lives in the
 * separate store context (card #15), mounted by the provider.
 */
export interface WorkspaceConfig {
  components: BlockComponentRegistry;
  dataSource: WorkspaceDataSource;
  /** For read-time contract-drift detection (card #17). */
  validation: ValidationContext;
  /** Telemetry: fires once when any block renders degraded. */
  onBlockDegraded?: OnBlockDegraded | undefined;
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
