/**
 * @workspace-engine/react — the read-time SDK.
 *
 * A validated WorkspaceSpec becomes a live screen with zero LLM involvement:
 * WorkspaceProvider wires contracts + blocks once (#16); the deterministic
 * renderer (#13) lays blocks on a grid; the React Query data layer (#14) fetches
 * each binding through the vendor's `fetch` with the end-user's auth; headless
 * hooks (#15) cover list/load/edit. SSR-safe: no `window`/`document` at module
 * load; `react` is the only peer.
 */
export const SDK_VERSION = "0.1.0";

// Provider + block registration (the 3-step integration surface)
export {
  WorkspaceProvider,
  type WorkspaceProviderProps,
} from "./provider/WorkspaceProvider";
export {
  defineBlock,
  buildBlockRegistry,
  type BlockDefinition,
  type BlockAccepts,
  type BlockShape,
  type RegisterBlocksContext,
} from "./provider/defineBlock";
export {
  useWorkspaceConfig,
  type WorkspaceConfig,
} from "./provider/config-context";

// Renderer
export { WorkspaceRenderer, type WorkspaceRendererProps } from "./renderer/WorkspaceRenderer";
export { WorkspaceGrid, type WorkspaceGridProps } from "./renderer/WorkspaceGrid";
export { BlockHost, type BlockHostProps, type BlockDriftError } from "./renderer/BlockHost";
export {
  type BlockDegradationEvent,
  type BlockDegradationReason,
  type OnBlockDegraded,
} from "./renderer/degradation";
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
export {
  WorkspaceFilterProvider,
  useWorkspaceFilters,
  useRuntimeFilters,
} from "./query/filters";

// Headless workspace hooks (#15) + persistence port
export {
  WorkspaceStoreProvider,
  type WorkspaceStoreProviderProps,
  useWorkspaceStore,
  useWorkspaceValidationContext,
} from "./workspace/context";
export {
  createInMemoryWorkspaceStore,
  createBlankSpec,
  type WorkspaceStore,
  type WorkspaceRecord,
  type WorkspaceSummary,
} from "./workspace/store";
export {
  useWorkspaceList,
  WORKSPACE_LIST_KEY,
  type WorkspaceListState,
} from "./workspace/useWorkspaceList";
export {
  useWorkspace,
  workspaceKey,
  type WorkspaceState,
} from "./workspace/useWorkspace";
export {
  useWorkspaceEditor,
  type WorkspaceEditor,
  type WorkspaceEditorParams,
} from "./workspace/useWorkspaceEditor";

// Typed error taxonomy (single import site)
export {
  BindingFetchError,
  BlockRegistrationError,
  WorkspaceNotFoundError,
  WorkspaceEditorSaveError,
  ContractDefinitionError,
  QueryPolicyError,
  SpecParseError,
  SpecMigrationError,
} from "./errors";

export type { WorkspaceSpec } from "@workspace-engine/core";
