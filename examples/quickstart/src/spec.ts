// Step 4 — a workspace is data, not code. This one came out of the
// generation pipeline; you could also write it by hand, like here. Either
// way it only renders after validateSpec says BUILD.
import { parseSpec } from "@workspace-engine/core";

export const ticketBoardSpec = parseSpec({
  specVersion: 1,
  title: "Support triage",
  timezone: "viewer",
  blocks: [
    {
      id: "blk_kpis",
      type: "KpiCards",
      frame: { x: 0, y: 0, w: 12, h: 2 },
      config: {
        cards: [
          { alias: "open_tickets", label: "Open tickets" },
          { alias: "avg_age", label: "Avg age (h)" },
        ],
      },
      binding: {
        entity: "ticket",
        query: {
          aggregations: [
            { fn: "count", alias: "open_tickets" },
            { fn: "avg", field: "ageHours", alias: "avg_age" },
          ],
        },
      },
    },
    {
      id: "blk_board",
      type: "GroupedBoard",
      frame: { x: 0, y: 2, w: 6, h: 6 },
      config: { title: "By priority" },
      binding: { entity: "ticket", query: { groupBy: "priority" } },
    },
    {
      id: "blk_oldest",
      type: "CasesTable",
      frame: { x: 6, y: 2, w: 6, h: 6 },
      config: {
        title: "Oldest first",
        columns: ["subject", "priority", "assignee", "ageHours"],
      },
      binding: {
        entity: "ticket",
        query: { sort: [{ field: "ageHours", dir: "desc" }], limit: 20 },
      },
    },
  ],
});
