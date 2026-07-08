/**
 * @workspace-engine/react — the read-time SDK.
 *
 * Deterministic renderer (#13) + query executor / React Query data layer (#14):
 * a validated WorkspaceSpec becomes a live screen with zero LLM involvement,
 * fetching each block's binding through the vendor's `fetch` with the end-user's
 * auth. Headless hooks and the WorkspaceProvider land in the remaining Phase 2
 * cards. SSR-safe: no `window`/`document` access at module load; `react` is the
 * only peer.
 */
export const SDK_VERSION = "0.1.0";

// Renderer
export { WorkspaceRenderer, type WorkspaceRendererProps } from "./renderer/WorkspaceRenderer";
export { WorkspaceGrid, type WorkspaceGridProps } from "./renderer/WorkspaceGrid";
export { BlockHost, type BlockHostProps } from "./renderer/BlockHost";
export { BrokenBlock, type BrokenBlockProps } from "./renderer/BrokenBlock";
export { BlockSkeleton, type BlockSkeletonProps } from "./renderer/BlockSkeleton";
export { BlockErrorBoundary } from "./renderer/BlockErrorBoundary";
export type {
  BlockComponent,
  BlockComponentProps,
  BlockComponentRegistry,
  WorkspaceDataSource,
} from "./renderer/types";

// Query / data layer
export {
  createWorkspaceQueryClient,
  WorkspaceQueryClientProvider,
  type WorkspaceQueryClientProviderProps,
} from "./query/client";
export {
  useBlockQuery,
  type BlockStatus,
  type BlockDataState,
  type UseBlockQueryParams,
} from "./query/useBlockQuery";
export { resolveQueryDates, effectiveZone, type ResolveOptions } from "./query/resolve-dates";
export { BindingFetchError } from "./query/errors";

export type { WorkspaceSpec } from "@workspace-engine/core";
