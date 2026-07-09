/**
 * @workspace-engine/ui — the default block set.
 *
 * A complete, themeable set of blocks (table, KPIs, queue, board, filter bar,
 * chart) so day-1 integration needs zero component adaptation and looks decent.
 * Themed entirely through `--we-*` CSS custom properties (see `tokens`); native
 * controls throughout (no clickable divs). Swap for your own components one
 * block at a time.
 */
export { defaultBlocks } from "./blocks";
export { Table, KpiCards, Queue, Board, Graph } from "./blocks/data-blocks";
export { FilterBar } from "./blocks/filter-bar";
export { tokens, TOKEN_NAMES } from "./theme";

// devMode sandbox (card #40): zero-config live workspace against a bundled sample.
export { WorkspaceSandbox, type WorkspaceSandboxProps } from "./sandbox";
export { sampleContract, sampleSpec, SAMPLE_ROWS, type SampleRow } from "./sample";
