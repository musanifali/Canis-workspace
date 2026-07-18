/**
 * Shared fixtures for the /v1 e2e suite (card #87).
 *
 * Since the Workspace Service now re-gates every save with `validateSpec`
 * against the tenant's registered `data_contracts`, an e2e that saves a bound
 * spec must first register the contract that spec references. These helpers
 * provide the canonical demo `case` contract (serialized the same way the
 * service revives it) and BUILD-valid spec bodies bound to it.
 */
import { defineEntity, serializeContract } from "@workspace-engine/core";
import { dataContracts, type WorkspaceDb } from "@workspace-engine/db";
import { randomUUID } from "node:crypto";
import { z } from "zod";

/** The demo `case` contract, defined the vendor way (declaration + fetch). */
const caseContract = defineEntity({
  name: "case",
  schema: z.object({
    id: z.string(),
    title: z.string(),
    customer: z.string(),
    risk: z.enum(["low", "medium", "high"]),
    status: z.enum(["open", "in_review", "closed"]),
    riskScore: z.number(),
    amountUsd: z.number(),
    dueDate: z.string(),
  }),
  fieldKinds: { dueDate: "date" },
  capabilities: {
    filterable: ["risk", "status", "title", "customer", "dueDate"],
    sortable: ["riskScore", "amountUsd", "dueDate"],
    groupable: ["risk", "status"],
    aggregations: { riskScore: ["avg", "max"], amountUsd: ["sum", "avg"] },
    defaultLimit: 50,
    maxLimit: 200,
  },
  fetch: async () => [],
});

/** The serialized `case` contract as it lives in `data_contracts.definition`. */
export const caseContractDefinition = serializeContract(caseContract);

/**
 * Register the `case` contract for a tenant on the owner connection (contract
 * registration is an admin operation, like tenant provisioning).
 */
export async function registerCaseContract(
  db: WorkspaceDb,
  tenantId: string,
): Promise<void> {
  await db.insert(dataContracts).values({
    id: `dc_${randomUUID()}`,
    tenantId,
    entityName: "case",
    definition: caseContractDefinition as unknown as Record<string, unknown>,
  });
}

/** A BUILD-valid spec: a CasesTable bound to `case` with an open query. */
export function caseSpec(title: string) {
  return {
    specVersion: 1 as const,
    title,
    timezone: "viewer",
    refresh: { mode: "manual" as const },
    layout: { columns: 12 as const },
    blocks: [
      {
        id: "blk_a1",
        type: "CasesTable",
        frame: { x: 0, y: 0, w: 6, h: 4 },
        config: {},
        binding: { entity: "case", query: { filters: [], sort: [] } },
      },
    ],
  };
}

/** The same wrapped as a save request body. */
export const caseSpecBody = (title: string) => ({ spec: caseSpec(title) });
