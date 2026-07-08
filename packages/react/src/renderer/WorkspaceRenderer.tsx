import type { ErrorInfo, ReactElement } from "react";
import type { Block, WorkspaceSpec } from "@workspace-engine/core";
import type { BlockComponentRegistry, WorkspaceDataSource } from "./types";
import { WorkspaceGrid } from "./WorkspaceGrid";
import { WorkspaceQueryClientProvider } from "../query/client";

export interface WorkspaceRendererProps {
  spec: WorkspaceSpec;
  components: BlockComponentRegistry;
  /** Contracts + auth for bound blocks. Omit for a static (config-only) render. */
  dataSource?: WorkspaceDataSource | undefined;
  className?: string | undefined;
  rowHeight?: number | undefined;
  gap?: number | undefined;
  onBlockError?: ((block: Block, error: Error, info: ErrorInfo) => void) | undefined;
}

/**
 * The read-time entry point: turn a validated WorkspaceSpec into a live screen
 * with zero LLM involvement. When a data source is present it mounts the
 * internal React Query provider automatically, so bound blocks fetch without the
 * consumer wiring React Query themselves. The full provider + block registration
 * ergonomics compose around this in card #16.
 */
export function WorkspaceRenderer({
  spec,
  components,
  dataSource,
  className,
  rowHeight,
  gap,
  onBlockError,
}: WorkspaceRendererProps): ReactElement {
  const grid = (
    <WorkspaceGrid
      spec={spec}
      components={components}
      dataSource={dataSource}
      className={className}
      rowHeight={rowHeight}
      gap={gap}
      onBlockError={onBlockError}
    />
  );

  return (
    <div data-workspace-renderer="" data-workspace-title={spec.title}>
      {dataSource ? (
        <WorkspaceQueryClientProvider>{grid}</WorkspaceQueryClientProvider>
      ) : (
        grid
      )}
    </div>
  );
}
