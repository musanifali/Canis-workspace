/**
 * Provision the demo tenant + an API key against the local Workspace Service
 * Postgres (packages/db docker compose). Idempotent for the tenant; every
 * run mints a fresh key (only the hash is stored — copy the printed key).
 *
 * Usage:  node scripts/seed-demo-tenant.mjs
 * Then put the printed values in demo/.env.local:
 *   NEXT_PUBLIC_WORKSPACE_API_URL=http://localhost:8270
 *   NEXT_PUBLIC_WORKSPACE_API_KEY=<printed key>
 */
import { defineEntity, serializeContract } from "@workspace-engine/core";
import {
  createApiKey,
  createDbClient,
  dataContracts,
  tenants,
} from "@workspace-engine/db";
import { z } from "zod";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5443/workspace_engine";
const TENANT_ID = "ten_demo";

/**
 * The demo `case` contract, registered server-side so the Workspace Service
 * can re-gate saves with the same validateSpec the demo runs client-side
 * (card #87). SOURCE OF TRUTH is demo/src/workspace-engine/case-contract.ts —
 * this declaration MUST stay in sync with it (fields, kinds, capabilities), or
 * a spec the demo builds client-side could be rejected server-side. Only the
 * declarative surface is stored; the vendor's fetch stays vendor-side (ADR-4).
 */
const caseContract = defineEntity({
  name: "case",
  schema: z.object({
    id: z.string(),
    title: z.string(),
    customer: z.string(),
    risk: z.enum(["low", "medium", "high", "critical"]),
    riskScore: z.number(),
    status: z.string(),
    category: z.string(),
    analyst: z.string(),
    openedDate: z.string(),
    dueDate: z.string(),
    amountUsd: z.number(),
  }),
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
  fetch: async () => [],
});

const client = createDbClient(DATABASE_URL);
try {
  await client.db
    .insert(tenants)
    .values({ id: TENANT_ID, name: "Canis Demo" })
    .onConflictDoNothing();
  await client.db
    .insert(dataContracts)
    .values({
      id: "dc_demo_case",
      tenantId: TENANT_ID,
      entityName: "case",
      definition: serializeContract(caseContract),
    })
    .onConflictDoUpdate({
      target: [dataContracts.tenantId, dataContracts.entityName],
      set: { definition: serializeContract(caseContract), updatedAt: new Date() },
    });
  const key = await createApiKey(client.db, {
    tenantId: TENANT_ID,
    name: `demo-${new Date().toISOString().slice(0, 10)}`,
  });
  console.log(`tenant:   ${TENANT_ID}`);
  console.log(`contract: case (registered)`);
  console.log(`api key:  ${key.rawKey}`);
  console.log("\ndemo/.env.local:");
  console.log("NEXT_PUBLIC_WORKSPACE_API_URL=http://localhost:8270");
  console.log(`NEXT_PUBLIC_WORKSPACE_API_KEY=${key.rawKey}`);
} finally {
  await client.close();
}
