/**
 * @workspace-engine/react — the read-time SDK.
 *
 * Deterministic renderer (card #13): a validated WorkspaceSpec becomes a live
 * screen with zero LLM involvement. Headless hooks, the data layer, and the
 * WorkspaceProvider land in the remaining Phase 2 cards. SSR-safe: no
 * `window`/`document` access at module load; `react` is the only peer.
 */
export const SDK_VERSION = "0.1.0";

export { WorkspaceRenderer, type WorkspaceRendererProps } from "./renderer/WorkspaceRenderer";
export { WorkspaceGrid, type WorkspaceGridProps } from "./renderer/WorkspaceGrid";
export { BrokenBlock, type BrokenBlockProps } from "./renderer/BrokenBlock";
export { BlockErrorBoundary } from "./renderer/BlockErrorBoundary";
export type {
  BlockComponent,
  BlockComponentProps,
  BlockComponentRegistry,
} from "./renderer/types";

export type { WorkspaceSpec } from "@workspace-engine/core";
