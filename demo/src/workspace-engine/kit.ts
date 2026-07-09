/**
 * Demo integration kit: the contracts + registered blocks a vendor passes to
 * WorkspaceProvider. This is the "3-step integration surface" (card #16) filled
 * in with the demo's compliance domain.
 */
import { defineBlock } from "@workspace-engine/react";
import { caseContract } from "./case-contract";
import {
  CaseQueueBlock,
  CasesTableBlock,
  GroupedBoardBlock,
  KpiCardsBlock,
} from "./blocks";

export const contracts = [caseContract];

export const blocks = [
  defineBlock({ type: "CasesTable", accepts: { shape: "rows", entities: ["case"] }, component: CasesTableBlock }),
  defineBlock({ type: "KpiCards", accepts: { shape: "aggregate", entities: ["case"] }, component: KpiCardsBlock }),
  defineBlock({ type: "CaseQueue", accepts: { shape: "rows", entities: ["case"] }, component: CaseQueueBlock }),
  defineBlock({ type: "GroupedBoard", accepts: { shape: "groups", entities: ["case"] }, component: GroupedBoardBlock }),
];
