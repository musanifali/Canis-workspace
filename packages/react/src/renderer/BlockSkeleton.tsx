import type { CSSProperties, ReactElement } from "react";

export interface BlockSkeletonProps {
  /** Number of shimmer lines to draw. Default 3. */
  lines?: number | undefined;
  /** Accessible label announced while loading. */
  label?: string | undefined;
}

const bar: CSSProperties = {
  height: "0.75rem",
  borderRadius: "0.25rem",
  background:
    "linear-gradient(90deg, rgba(0,0,0,0.06) 25%, rgba(0,0,0,0.12) 37%, rgba(0,0,0,0.06) 63%)",
};

/**
 * A content-shaped loading placeholder — deliberately NOT a spinner. The
 * product rule is "per-block loading skeletons, never spinner-only": each block
 * shows its own shaped placeholder in place, so the workspace never collapses to
 * one global spinner. The default block set (card #39) ships type-specific
 * skeletons; this is the headless primitive and the renderer's fallback.
 */
export function BlockSkeleton({
  lines = 3,
  label = "Loading…",
}: BlockSkeletonProps): ReactElement {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      data-workspace-skeleton=""
      style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
    >
      {Array.from({ length: Math.max(1, lines) }, (_, i) => (
        <div
          key={i}
          data-skeleton-line=""
          style={{ ...bar, width: i === 0 ? "45%" : i % 2 === 0 ? "80%" : "100%" }}
        />
      ))}
    </div>
  );
}
