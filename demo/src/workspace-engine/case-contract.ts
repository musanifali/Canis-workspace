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

/** Shared declaration — the surface is identical however rows are fetched. */
const caseContractDeclaration = {
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
} as const;

/** The `case` contract: field kinds, capabilities, and the (trivial) executor. */
export const caseContract = defineEntity({
  ...caseContractDeclaration,
  // Return rows; @workspace-engine/core's client-side engine does the querying.
  fetch: async () => ALL_CASES,
});

/**
 * The same contract backed by the demo vendor's REAL backend (ADR-4
 * exercised): rows come from /api/vendor/cases/query, which answers only
 * under the end user's session token. `auth` arrives here UNCHANGED from
 * WorkspaceProvider's `userToken` and is presented as the Bearer credential —
 * no token (or a forged one) means 401, and the block surfaces a fetch error
 * instead of data.
 */
export function createRemoteCaseContract(baseUrl = "") {
  return defineEntity({
    ...caseContractDeclaration,
    fetch: async ({ auth }) => {
      const response = await fetch(`${baseUrl}/api/vendor/cases/query`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${String(auth)}`,
        },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        throw new Error(
          `vendor case backend refused the query (${response.status})`,
        );
      }
      const payload = (await response.json()) as { rows: Case[] };
      return payload.rows;
    },
  });
}
