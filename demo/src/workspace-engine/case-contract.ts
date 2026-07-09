/**
 * Workspace Engine demo kit — the `case` data contract.
 *
 * Wires the demo's seeded compliance dataset (src/services/case-management.ts)
 * to @workspace-engine/core via defineEntity. The vendor `fetch` here does the
 * simplest possible thing — return the rows — and the SDK's in-memory query
 * engine (card #38) runs filter/sort/group/aggregate client-side. That's the
 * whole adoption pitch: "return a list," not "rewrite your API."
 */
import { defineEntity } from "@workspace-engine/core";
import { caseSchema, searchCases, type Case } from "@/services/case-management";

/** Every seeded case, loaded once (240 = dataset size cap). */
const ALL_CASES: Case[] = searchCases({ limit: 240 }).cases;

/** The `case` contract: field kinds, capabilities, and the (trivial) executor. */
export const caseContract = defineEntity({
  name: "case",
  schema: caseSchema,
  fieldKinds: { openedDate: "date", dueDate: "date" },
  capabilities: {
    filterable: ["risk", "status", "category", "analyst", "riskScore", "amountUsd", "dueDate", "title", "customer"],
    sortable: ["riskScore", "amountUsd", "dueDate", "openedDate"],
    groupable: ["risk", "status", "category", "analyst"],
    aggregations: {
      riskScore: ["avg", "max"],
      amountUsd: ["sum", "avg"],
    },
    defaultLimit: 50,
    maxLimit: 200,
  },
  // Return rows; @workspace-engine/core's client-side engine does the querying.
  fetch: async () => ALL_CASES,
});
