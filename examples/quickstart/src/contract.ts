// Step 2 — declare what your data looks like and what queries you allow.
// This is the whole integration contract: the model, the validator, and the
// renderer all work from this one declaration.
import { defineEntity } from "@workspace-engine/core";
import { z } from "zod";

export const ticketContract = defineEntity({
  name: "ticket",
  schema: z
    .object({
      id: z.string().describe("Ticket id from your helpdesk."),
      subject: z.string().describe("One-line customer-facing summary."),
      priority: z
        .enum(["low", "normal", "urgent"])
        .describe("Priority: low (backlog), normal (this week), urgent (today)."),
      assignee: z.string().describe("Support agent the ticket is assigned to."),
      ageHours: z.number().describe("Hours since the ticket was opened."),
      opened: z.string().describe("Day the ticket was opened (YYYY-MM-DD)."),
    })
    .describe("A customer support ticket from your helpdesk."),
  fieldKinds: { opened: "date" },
  capabilities: {
    filterable: ["priority", "assignee", "ageHours", "subject"],
    sortable: ["ageHours", "opened"],
    groupable: ["priority", "assignee"],
    aggregations: { ageHours: ["avg", "max"] },
    defaultLimit: 50,
    maxLimit: 200,
  },
  // Your fetch just returns rows — filtering/sorting/grouping run in the
  // SDK's engine. `auth` is your end user's token, passed through untouched.
  fetch: async ({ auth }) => {
    const response = await fetch("/api/tickets", {
      headers: { authorization: `Bearer ${String(auth)}` },
    });
    return (await response.json()) as unknown[];
  },
});
