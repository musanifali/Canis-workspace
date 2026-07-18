"use client";

// CLIENT module — everything from @workspace-engine/* lives on this side of
// the boundary. The contract is created HERE (it holds a fetch function,
// which can never cross from a server component), and its fetch calls the
// server data route with the end user's token.
import { defineEntity, parseSpec } from "@workspace-engine/core";
import { WorkspaceProvider, WorkspaceRenderer } from "@workspace-engine/react";
import { defaultBlocks } from "@workspace-engine/ui";
import { z } from "zod";

const ticketContract = defineEntity({
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
  fetch: async ({ auth }) => {
    const response = await fetch("/api/tickets", {
      headers: { authorization: `Bearer ${String(auth)}` },
    });
    if (!response.ok) throw new Error(`tickets API ${response.status}`);
    return (await response.json()) as unknown[];
  },
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
          { alias: "avg_age", label: "Avg age (h)" },
        ],
      },
      binding: {
        entity: "ticket",
        query: {
          aggregations: [
            { fn: "count", alias: "open" },
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

export { ticketContract };

export function TicketWorkspace({ userToken }: { userToken: string }) {
  return (
    <WorkspaceProvider
      apiKey="next-example-local"
      userToken={userToken}
      contracts={[ticketContract]}
      blocks={defaultBlocks}
    >
      <WorkspaceRenderer spec={triageSpec} />
    </WorkspaceProvider>
  );
}
