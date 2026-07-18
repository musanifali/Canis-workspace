/**
 * Vendor-side seeding (#53): everything here goes through the public /v1 API
 * with the tenant key — register Canis's contracts, save the analytics views
 * (server-validated: the service re-gates each spec), leave a couple of
 * deliberately refused saves so the Rejected-capabilities view has data, and
 * record a few generation events so Usage & cost isn't empty.
 *
 * Usage:  WORKSPACE_API_KEY=… npm run seed -w @workspace-engine/dashboard
 * (reads apps/dashboard/.env.local when run via npm script)
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseSpec,
  serializeContract,
  serializeSpec,
} from "@workspace-engine/core";
import {
  createWorkspaceServiceClient,
  WorkspaceServiceError,
} from "@workspace-engine/client";
import { createCanisContracts, type CanisReadClient } from "../src/canis/contracts.js";
import { dashboardViews } from "../src/canis/specs.js";

// Minimal .env.local loader — no dotenv dependency for a seed script.
function loadEnvLocal(): void {
  try {
    const raw = readFileSync(join(import.meta.dirname, "..", ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
      if (match && process.env[match[1]!] === undefined) {
        process.env[match[1]!] = match[2]!;
      }
    }
  } catch {
    // No .env.local — rely on the ambient environment.
  }
}
loadEnvLocal();

const apiKey = process.env.WORKSPACE_API_KEY;
if (!apiKey) {
  console.error(
    "WORKSPACE_API_KEY is not set. Provision first:\n" +
      "  node scripts/seed-dashboard-tenant.mjs   (repo root)",
  );
  process.exit(1);
}

const client = createWorkspaceServiceClient({
  baseUrl: process.env.WORKSPACE_API_URL ?? "http://localhost:8270",
  apiKey,
  userId: process.env.WORKSPACE_DASHBOARD_USER ?? "canis_ops",
});

// The seed only needs the declarative surface; fetches are never uploaded.
const stub: CanisReadClient = {
  listAudit: async () => [],
  getUsageSummary: async () => ({
    month: { generations: 0, costCents: 0 },
    perWorkspace: [],
  }),
  listWorkspaces: async () => [],
};

for (const contract of createCanisContracts(stub)) {
  await client.upsertContract(
    contract.name,
    serializeContract(contract) as unknown as Record<string, unknown>,
  );
  console.log(`contract: ${contract.name} (registered via /v1/contracts)`);
}

const existing = await client.listWorkspaces();
const byTitle = new Map(existing.map((w) => [w.title, w.id]));
const viewIds: string[] = [];
for (const view of dashboardViews) {
  const foundId = byTitle.get(view.spec.title);
  if (foundId) {
    const current = await client.getWorkspace(foundId);
    if (serializeSpec(current.spec) === serializeSpec(view.spec)) {
      console.log(`view: "${view.spec.title}" unchanged (${foundId})`);
    } else {
      await client.updateWorkspace(foundId, { spec: view.spec });
      console.log(`view: "${view.spec.title}" updated (${foundId})`);
    }
    viewIds.push(foundId);
  } else {
    const created = await client.createWorkspace({
      spec: view.spec,
      prompt: `seeded dashboard view: ${view.slug}`,
    });
    console.log(`view: "${view.spec.title}" created (${created.id})`);
    viewIds.push(created.id);
  }
}

// Two saves the server must refuse — the Rejected-capabilities view's data.
const refusals = [
  parseSpec({
    specVersion: 1,
    title: "Invoices overview",
    timezone: "viewer",
    blocks: [
      {
        id: "blk_x",
        type: "CasesTable",
        frame: { x: 0, y: 0, w: 6, h: 4 },
        config: {},
        binding: { entity: "invoice", query: {} },
      },
    ],
  }),
  parseSpec({
    specVersion: 1,
    title: "Audit by workspace id",
    timezone: "viewer",
    blocks: [
      {
        id: "blk_y",
        type: "Graph",
        frame: { x: 0, y: 0, w: 6, h: 4 },
        config: { title: "By workspace", kind: "bar" },
        binding: {
          entity: "audit_event",
          // workspaceId is not groupable — a real capability gap, refused.
          query: { groupBy: "workspaceId", aggregations: [{ fn: "count", alias: "n" }] },
        },
      },
    ],
  }),
];
for (const spec of refusals) {
  try {
    await client.createWorkspace({ spec });
    console.error(`UNEXPECTED: "${spec.title}" was accepted — seed data is off`);
  } catch (error) {
    if (error instanceof WorkspaceServiceError && error.status === 422) {
      console.log(`refusal: "${spec.title}" 422 as intended (audit-logged)`);
    } else {
      throw error;
    }
  }
}

// A little usage so the cost view has bars.
for (const [index, id] of viewIds.entries()) {
  await client.recordGeneration({ workspaceId: id, costCents: 6 * (index + 1) });
}
console.log(`usage: ${viewIds.length} generation events recorded`);
console.log("\nDone. Open http://localhost:3002");
