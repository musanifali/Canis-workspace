/**
 * @workspace-engine/react — the read-time SDK.
 *
 * Deterministic renderer, headless hooks, and the WorkspaceProvider land in
 * Phase 2 cards #13–#17. This entry point is intentionally thin for now: it
 * pins the SDK version and re-exports the spec type so consumers have a single
 * import site. It stays SSR-safe (no `window`/`document` access at module load)
 * and depends only on `react` as a peer.
 */
export const SDK_VERSION = "0.1.0";

export type { WorkspaceSpec } from "@workspace-engine/core";
