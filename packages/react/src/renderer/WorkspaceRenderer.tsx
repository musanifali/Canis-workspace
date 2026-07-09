import { useContext, type ErrorInfo, type ReactElement } from "react";
import type { Block, ValidationContext, WorkspaceSpec } from "@workspace-engine/core";
import type { BlockComponentRegistry, WorkspaceDataSource } from "./types";
import type { OnBlockDegraded } from "./degradation";
import { WorkspaceGrid } from "./WorkspaceGrid";
import { WorkspaceQueryClientProvider } from "../query/client";
import { WorkspaceFilterProvider } from "../query/filters";
import { WorkspaceConfigContext } from "../provider/config-context";

export interface WorkspaceRendererProps {
  spec: WorkspaceSpec;
  /** Block components; omit to use the ones registered on WorkspaceProvider. */
  components?: BlockComponentRegistry | undefined;
  /** Contracts + auth; omit to use the WorkspaceProvider's data source. */
  dataSource?: WorkspaceDataSource | undefined;
  /** Enables read-time contract-drift detection; omit to use the provider's. */
  validation?: ValidationContext | undefined;
  className?: string | undefined;
  rowHeight?: number | undefined;
  gap?: number | undefined;
  onBlockError?: ((block: Block, error: Error, info: ErrorInfo) => void) | undefined;
  /** Telemetry: fires once when any block renders degraded. */
  onBlockDegraded?: OnBlockDegraded | undefined;
}

/**
 * The read-time entry point: turn a validated WorkspaceSpec into a live screen
 * with zero LLM involvement. Inside a WorkspaceProvider (card #16) it reads the
 * registered components, data source, validation context, and degradation
 * telemetry from context, so `<WorkspaceRenderer spec={…} />` is all a consumer
 * writes. Used standalone it takes them as props and mounts its own internal
 * React Query client when a data source is present.
 */
export function WorkspaceRenderer({
  spec,
  components: componentsProp,
  dataSource: dataSourceProp,
  validation: validationProp,
  className,
  rowHeight,
  gap,
  onBlockError,
  onBlockDegraded: onBlockDegradedProp,
}: WorkspaceRendererProps): ReactElement {
  const config = useContext(WorkspaceConfigContext);
  const components = componentsProp ?? config?.components;
  const dataSource = dataSourceProp ?? config?.dataSource;
  const validation = validationProp ?? config?.validation;
  const onBlockDegraded = onBlockDegradedProp ?? config?.onBlockDegraded;

  if (!components) {
    throw new Error(
      "WorkspaceRenderer needs `components` — pass them as a prop or wrap it in a WorkspaceProvider.",
    );
  }

  const grid = (
    <WorkspaceFilterProvider>
      <WorkspaceGrid
        spec={spec}
        components={components}
        dataSource={dataSource}
        validation={validation}
        className={className}
        rowHeight={rowHeight}
        gap={gap}
        onBlockError={onBlockError}
        onBlockDegraded={onBlockDegraded}
      />
    </WorkspaceFilterProvider>
  );

  // Inside a WorkspaceProvider the query client is already mounted; only
  // self-mount it for standalone use that actually fetches data.
  const needsOwnQueryClient = config === null && dataSource != null;

  return (
    <div data-workspace-renderer="" data-workspace-title={spec.title}>
      {needsOwnQueryClient ? (
        <WorkspaceQueryClientProvider>{grid}</WorkspaceQueryClientProvider>
      ) : (
        grid
      )}
    </div>
  );
}
