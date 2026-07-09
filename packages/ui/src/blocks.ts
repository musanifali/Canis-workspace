import { defineBlock, type BlockDefinition } from "@workspace-engine/react";
import { Board, Graph, KpiCards, Queue, Table } from "./blocks/data-blocks";
import { FilterBar } from "./blocks/filter-bar";

/**
 * The six default block definitions, ready to hand to WorkspaceProvider. Day-1
 * integration needs zero component work:
 *
 *   <WorkspaceProvider contracts={…} blocks={defaultBlocks} …>
 *
 * Swap for your own design-system component one block at a time by overriding
 * a single entry (see the swap-path doc in the package README).
 */
export const defaultBlocks: BlockDefinition[] = [
  defineBlock({ type: "CasesTable", accepts: { shape: "rows" }, component: Table }),
  defineBlock({ type: "KpiCards", accepts: { shape: "aggregate" }, component: KpiCards }),
  defineBlock({ type: "CaseQueue", accepts: { shape: "rows" }, component: Queue }),
  defineBlock({ type: "GroupedBoard", accepts: { shape: "groups" }, component: Board }),
  defineBlock({ type: "FilterBar", accepts: { shape: "none" }, component: FilterBar }),
  defineBlock({ type: "Graph", accepts: { shape: "aggregate" }, component: Graph }),
];
