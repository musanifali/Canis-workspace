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
import { caseContract } from "./case-contract";

export const contracts = [caseContract];

export const blocks = defaultBlocks;
