/**
 * Three hand-written workspaces — plain JSON documents that become live screens
 * against the demo `case` contract, with zero LLM involvement (card #18). Each
 * is run through parseSpec so it carries schema defaults and is a real
 * WorkspaceSpec; WorkspaceProvider then validates it against the contract.
 */
import { parseSpec, type WorkspaceSpec } from "@workspace-engine/core";

export interface DemoWorkspace {
  id: string;
  label: string;
  spec: WorkspaceSpec;
}

const complianceOverview = parseSpec({
  specVersion: 1,
  title: "Compliance Overview",
  timezone: "UTC",
  blocks: [
    {
      id: "blk_kpi",
      type: "KpiCards",
      frame: { x: 0, y: 0, w: 12, h: 2 },
      config: {
        cards: [
          { alias: "total", label: "Total cases" },
          { alias: "avg_risk", label: "Avg risk score" },
          { alias: "exposure", label: "Exposure (USD)" },
        ],
      },
      binding: {
        entity: "case",
        query: {
          aggregations: [
            { fn: "count", alias: "total" },
            { fn: "avg", field: "riskScore", alias: "avg_risk" },
            { fn: "sum", field: "amountUsd", alias: "exposure" },
          ],
        },
      },
    },
    {
      id: "blk_hirisk",
      type: "CasesTable",
      frame: { x: 0, y: 2, w: 12, h: 6 },
      config: { title: "High & critical risk" },
      binding: {
        entity: "case",
        query: {
          filters: [{ field: "risk", op: "in", value: ["high", "critical"] }],
          sort: [{ field: "riskScore", dir: "desc" }],
          limit: 12,
        },
      },
    },
  ],
});

const overdueQueue = parseSpec({
  specVersion: 1,
  title: "Active Work Queue",
  timezone: "UTC",
  blocks: [
    {
      id: "blk_queue",
      type: "CaseQueue",
      frame: { x: 0, y: 0, w: 6, h: 8 },
      config: { title: "Open & escalated" },
      binding: {
        entity: "case",
        query: {
          filters: [{ field: "status", op: "in", value: ["open", "in_review", "escalated"] }],
          sort: [{ field: "dueDate", dir: "asc" }],
          limit: 20,
        },
      },
    },
    {
      id: "blk_exposure",
      type: "CasesTable",
      frame: { x: 6, y: 0, w: 6, h: 8 },
      config: { title: "Largest exposure" },
      binding: {
        entity: "case",
        query: {
          sort: [{ field: "amountUsd", dir: "desc" }],
          limit: 12,
        },
      },
    },
  ],
});

const portfolioByCategory = parseSpec({
  specVersion: 1,
  title: "Portfolio by Category",
  timezone: "UTC",
  blocks: [
    {
      id: "blk_stats",
      type: "KpiCards",
      frame: { x: 0, y: 0, w: 12, h: 2 },
      config: {
        cards: [
          { alias: "cases", label: "Cases" },
          { alias: "peak", label: "Peak risk score" },
        ],
      },
      binding: {
        entity: "case",
        query: {
          aggregations: [
            { fn: "count", alias: "cases" },
            { fn: "max", field: "riskScore", alias: "peak" },
          ],
        },
      },
    },
    {
      id: "blk_board",
      type: "GroupedBoard",
      frame: { x: 0, y: 2, w: 12, h: 6 },
      config: { title: "Grouped by category" },
      binding: {
        entity: "case",
        query: { groupBy: "category" },
      },
    },
  ],
});

export const demoWorkspaces: DemoWorkspace[] = [
  { id: "overview", label: "Compliance Overview", spec: complianceOverview },
  { id: "queue", label: "Active Work Queue", spec: overdueQueue },
  { id: "category", label: "Portfolio by Category", spec: portfolioByCategory },
];
