import type { ComponentType } from "react";
import type { Block, EntityContract } from "@workspace-engine/core";
import type { BlockDataState } from "../query/useBlockQuery";

/**
 * Props every registered block component receives: its `block` from the spec
 * plus the normalized data state for its binding. Static blocks (no binding)
 * get `status: "success"` with `data: undefined`. The renderer shows a skeleton
 * or broken state for the loading/error cases by default, so components can
 * assume they're rendering real data — but they receive the full state (via
 * `BlockDataState`) if they want richer handling (e.g. staleness indicators).
 */
export interface BlockComponentProps extends BlockDataState {
  block: Block;
}

/** A component that renders one block type (e.g. "CasesTable"). */
export type BlockComponent = ComponentType<BlockComponentProps>;

/**
 * Maps a spec block `type` to the component that renders it. The renderer looks
 * a block's type up here; a miss is a broken block, never a crash. The ergonomic
 * registration API that produces this lives in card #16.
 */
export type BlockComponentRegistry = Readonly<Record<string, BlockComponent>>;

/**
 * What the renderer needs to fetch bound blocks: the compiled contracts (by
 * entity name) and the end-user auth to pass through to their `fetch`. Supplied
 * to WorkspaceRenderer; the full provider/registration API is card #16.
 */
export interface WorkspaceDataSource {
  contracts: Readonly<Record<string, EntityContract>>;
  /** End-user auth, passed UNCHANGED to each contract's vendor fetch (ADR-4). */
  auth: unknown;
}
