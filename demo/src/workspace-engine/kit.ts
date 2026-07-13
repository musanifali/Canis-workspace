/**
 * Demo integration kit: the contracts + registered blocks a vendor passes to
 * WorkspaceProvider. This is the "3-step integration surface" (card #16) filled
 * in with the demo's compliance domain.
 *
 * Blocks come straight from @workspace-engine/ui (card #39) — day-1 integration
 * with zero component work. This file used to hand-roll four adapter components;
 * the swap deleted them. Override a single `defaultBlocks` entry to replace one
 * block with a design-system component (see the ui package's SWAP-PATH doc).
 */
import { defaultBlocks } from "@workspace-engine/ui";
import type { ValidationContext } from "@workspace-engine/core";
import { caseContract } from "./case-contract";
import type { CuratedSuggestions } from "./suggestions";

export const contracts = [caseContract];

/**
 * Vendor-pinned cold-start chips per role (card #46). These lead the derived
 * ones so a vendor can hand-tune the first impression: an analyst is nudged
 * toward triage, a manager toward portfolio rollups. Everything here is a plain
 * prompt string that still flows through the same generation + validation gate —
 * curation shapes the suggestion, never the output.
 */
export const curatedSuggestions: CuratedSuggestions = {
  analyst: [
    { label: "My queue today", prompt: "High-risk cases due this week, grouped by analyst" },
    { label: "Overdue cases", prompt: "Cases past their due date, highest risk first" },
  ],
  manager: [
    { label: "Exposure by category", prompt: "Total exposure by category across all cases" },
    { label: "Risk overview", prompt: "Average risk score and case count by status" },
  ],
};

export const blocks = defaultBlocks;

/**
 * The validation context (contracts keyed by entity name) that both the
 * generation gate (Phase A) and the renderer (Phase B) validate against — one
 * source of truth so a spec that passes the gate is a spec the renderer accepts.
 */
export const validationContext: ValidationContext = {
  contracts: Object.fromEntries(contracts.map((c) => [c.name, c])),
};
