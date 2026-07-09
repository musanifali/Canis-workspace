import { useMemo, type CSSProperties, type ErrorInfo, type ReactElement } from "react";
import {
  GRID_COLUMNS,
  validateSpec,
  type Block,
  type ValidationContext,
  type WorkspaceSpec,
} from "@workspace-engine/core";
import type { BlockComponentRegistry, WorkspaceDataSource } from "./types";
import { BlockHost, type BlockDriftError } from "./BlockHost";
import type { OnBlockDegraded } from "./degradation";

export interface WorkspaceGridProps {
  spec: WorkspaceSpec;
  components: BlockComponentRegistry;
  /** Contracts + auth for bound blocks. Omit for a static (config-only) render. */
  dataSource?: WorkspaceDataSource | undefined;
  /** Enables read-time contract-drift detection (re-validates the saved spec). */
  validation?: ValidationContext | undefined;
  /** Applied to the grid container. */
  className?: string | undefined;
  /** Height of one grid row unit, in px. Default 96. */
  rowHeight?: number | undefined;
  /** Gap between cells, in px. Default 16. */
  gap?: number | undefined;
  onBlockError?: ((block: Block, error: Error, info: ErrorInfo) => void) | undefined;
  /** Telemetry: fires once when any block renders degraded. */
  onBlockDegraded?: OnBlockDegraded | undefined;
}

/**
 * Positions every block on the fixed 12-column grid (CSS Grid, no layout
 * library, SSR-safe) and delegates each cell to BlockHost. When a validation
 * context is present it re-validates the saved spec once and maps each block's
 * error, so a workspace whose contract drifted since save renders every healthy
 * block plus an explicit broken state on the one that references data that no
 * longer exists — never a white screen, never a silent drop.
 */
export function WorkspaceGrid({
  spec,
  components,
  dataSource,
  validation,
  className,
  rowHeight = 96,
  gap = 16,
  onBlockError,
  onBlockDegraded,
}: WorkspaceGridProps): ReactElement {
  const driftByBlock = useMemo(
    () => buildDriftMap(spec, validation),
    [spec, validation],
  );

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
              driftError={driftByBlock.get(block.id)}
              timeZone={spec.timezone}
              refresh={spec.refresh}
              onBlockError={onBlockError}
              onBlockDegraded={onBlockDegraded}
            />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Re-validate the saved spec against the current contracts/registry/policy and
 * collect the first block-scoped error per block. An overall REJECT doesn't
 * blank the workspace — only the blocks that actually reference missing data
 * degrade; the rest render. Returns an empty map when no validation context is
 * supplied (standalone use), where a drifted block instead fails at fetch.
 *
 * Only errors with a singular `blockId` degrade a block. The two non-block-
 * scoped REJECT variants are intentionally NOT enforced retroactively on a
 * saved spec (review #67):
 *  - LayoutOverlapError — can't arise at read time: a saved spec passed
 *    validateSpec:BUILD at save, and contract drift never introduces overlaps.
 *  - BlockCountError — only from tenant-policy TIGHTENING (an admin lowering
 *    maxBlocks below a board's existing count). We deliberately render the
 *    board as authored rather than hiding end-users' blocks because an admin
 *    changed a cap after the fact; surfacing that to admins is a Phase 4 concern
 *    (revisit when real tenant policy is wired).
 */
function buildDriftMap(
  spec: WorkspaceSpec,
  validation: ValidationContext | undefined,
): Map<string, BlockDriftError> {
  const map = new Map<string, BlockDriftError>();
  if (!validation) return map;

  const verdict = validateSpec(spec, validation);
  if (verdict.verdict === "REJECT") {
    for (const error of verdict.errors) {
      if (error.blockId && !map.has(error.blockId)) {
        map.set(error.blockId, { message: error.message, fix: error.fix });
      }
    }
  }
  return map;
}
