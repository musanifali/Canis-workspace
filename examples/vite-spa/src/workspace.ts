// The whole integration in one module: a contract over local data and a
// hand-written, validated spec. See examples/quickstart for the annotated
// walk-through of each piece.
import { defineEntity, parseSpec } from "@workspace-engine/core";
import { z } from "zod";
import { TICKETS } from "./data";

export const ticketContract = defineEntity({
  name: "ticket",
  schema: z
    .object({
      id: z.string().describe("Ticket id."),
      subject: z.string().describe("One-line summary."),
      priority: z
        .enum(["low", "normal", "urgent"])
        .describe("Priority: low (backlog), normal (this week), urgent (today)."),
      assignee: z.string().describe("Agent owning the ticket."),
      ageHours: z.number().describe("Hours since opened."),
      opened: z.string().describe("Day opened (YYYY-MM-DD)."),
    })
    .describe("A customer support ticket."),
  fieldKinds: { opened: "date" },
  capabilities: {
    filterable: ["priority", "assignee", "ageHours"],
    sortable: ["ageHours", "opened"],
    groupable: ["priority", "assignee"],
    aggregations: { ageHours: ["avg", "max"] },
    defaultLimit: 50,
    maxLimit: 200,
  },
  fetch: async () => TICKETS,
});

export const triageSpec = parseSpec({
  specVersion: 1,
  title: "Ticket triage",
  timezone: "viewer",
  blocks: [
    {
      id: "blk_kpis",
      type: "KpiCards",
      frame: { x: 0, y: 0, w: 12, h: 2 },
      config: {
        cards: [
          { alias: "open", label: "Open tickets" },
          { alias: "max_age", label: "Oldest (h)", intent: "negative" },
        ],
      },
      binding: {
        entity: "ticket",
        query: {
          aggregations: [
            { fn: "count", alias: "open" },
            { fn: "max", field: "ageHours", alias: "max_age" },
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
      id: "blk_table",
      type: "CasesTable",
      frame: { x: 6, y: 2, w: 6, h: 6 },
      config: { title: "Oldest first", columns: ["subject", "priority", "ageHours"] },
      binding: {
        entity: "ticket",
        query: { sort: [{ field: "ageHours", dir: "desc" }], limit: 15 },
      },
    },
  ],
});
