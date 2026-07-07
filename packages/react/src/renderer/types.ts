import type { ComponentType } from "react";
import type { Block } from "@workspace-engine/core";

/**
 * Props every registered block component receives.
 *
 * At read time the renderer is deterministic: it hands the component its
 * `block` from the (already-validated) spec and nothing else. Query results,
 * loading/staleness state, and refresh controls are layered on by the query
 * executor in card #14 — they will arrive as additional fields here, so the
 * shape is a prop object rather than positional args on purpose.
 */
export interface BlockComponentProps {
  /** The block from the spec: id, type, frame, config, binding. */
  block: Block;
}

/** A component that renders one block type (e.g. "CasesTable"). */
export type BlockComponent = ComponentType<BlockComponentProps>;

/**
 * Maps a spec block `type` to the component that renders it. The renderer
 * looks a block's type up here; a miss is a broken block, never a crash.
 * The ergonomic registration API that produces this lives in card #16.
 */
export type BlockComponentRegistry = Readonly<Record<string, BlockComponent>>;
