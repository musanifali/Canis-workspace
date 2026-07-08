import type { CSSProperties, ErrorInfo, ReactElement } from "react";
import { GRID_COLUMNS, type Block, type WorkspaceSpec } from "@workspace-engine/core";
import type { BlockComponentRegistry, WorkspaceDataSource } from "./types";
import { BlockHost } from "./BlockHost";

export interface WorkspaceGridProps {
  spec: WorkspaceSpec;
  components: BlockComponentRegistry;
  /** Contracts + auth for bound blocks. Omit for a static (config-only) render. */
  dataSource?: WorkspaceDataSource | undefined;
  /** Applied to the grid container. */
  className?: string | undefined;
  /** Height of one grid row unit, in px. Default 96. */
  rowHeight?: number | undefined;
  /** Gap between cells, in px. Default 16. */
  gap?: number | undefined;
  /** Forwarded to each block's error boundary. */
  onBlockError?: ((block: Block, error: Error, info: ErrorInfo) => void) | undefined;
}

/**
 * Positions every block on the fixed 12-column grid using CSS Grid — no layout
 * library, SSR-safe, deterministic. A block's frame maps directly to grid
 * lines: `x`/`w` to columns, `y`/`h` to rows (both 1-indexed in CSS). Each cell
 * delegates to BlockHost, which handles data, loading, and broken states. The
 * spec is assumed already validated (write-time gate); this only renders.
 */
export function WorkspaceGrid({
  spec,
  components,
  dataSource,
  className,
  rowHeight = 96,
  gap = 16,
  onBlockError,
}: WorkspaceGridProps): ReactElement {
  const gridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(0, 1fr))`,
    gridAutoRows: `${rowHeight}px`,
    gap: `${gap}px`,
  };

  return (
    <div data-workspace-grid="" className={className} style={gridStyle}>
      {spec.blocks.map((block) => {
        const cellStyle: CSSProperties = {
          // CSS grid lines are 1-indexed; frame coordinates are 0-indexed.
          gridColumn: `${block.frame.x + 1} / span ${block.frame.w}`,
          gridRow: `${block.frame.y + 1} / span ${block.frame.h}`,
          minWidth: 0,
          minHeight: 0,
        };
        return (
          <div
            key={block.id}
            data-workspace-cell=""
            data-block-id={block.id}
            data-block-type={block.type}
            style={cellStyle}
          >
            <BlockHost
              block={block}
              components={components}
              dataSource={dataSource}
              timeZone={spec.timezone}
              refresh={spec.refresh}
              onBlockError={onBlockError}
            />
          </div>
        );
      })}
    </div>
  );
}
