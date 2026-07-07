import type { ErrorInfo, ReactElement } from "react";
import type { Block, WorkspaceSpec } from "@workspace-engine/core";
import type { BlockComponentRegistry } from "./types";
import { WorkspaceGrid } from "./WorkspaceGrid";

export interface WorkspaceRendererProps {
  spec: WorkspaceSpec;
  components: BlockComponentRegistry;
  className?: string | undefined;
  rowHeight?: number | undefined;
  gap?: number | undefined;
  onBlockError?: ((block: Block, error: Error, info: ErrorInfo) => void) | undefined;
}

/**
 * The read-time entry point: turn a validated WorkspaceSpec into a live screen
 * with zero LLM involvement. For now it renders the block grid; the data layer
 * (card #14) and provider/registration ergonomics (card #16) compose around it.
 */
export function WorkspaceRenderer({
  spec,
  components,
  className,
  rowHeight,
  gap,
  onBlockError,
}: WorkspaceRendererProps): ReactElement {
  return (
    <div data-workspace-renderer="" data-workspace-title={spec.title}>
      <WorkspaceGrid
        spec={spec}
        components={components}
        className={className}
        rowHeight={rowHeight}
        gap={gap}
        onBlockError={onBlockError}
      />
    </div>
  );
}
