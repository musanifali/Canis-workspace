/**
 * Provision the Canis-internal dashboard tenant + an API key (#53 dogfooding).
 * Admin operation only — contracts and workspaces are NOT seeded here: the
 * dashboard registers those through the public /v1 API like any vendor
 * (`npm run seed -w @workspace-engine/dashboard`).
 *
 * Usage:  node scripts/seed-dashboard-tenant.mjs
 * Then put the printed values in apps/dashboard/.env.local.
 */
import { createApiKey, createDbClient, tenants } from "@workspace-engine/db";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5443/workspace_engine";
const TENANT_ID = "ten_canis_internal";

const client = createDbClient(DATABASE_URL);
try {
  await client.db
    .insert(tenants)
    .values({ id: TENANT_ID, name: "Canis Internal (dashboard)" })
    .onConflictDoNothing();
  const key = await createApiKey(client.db, {
    tenantId: TENANT_ID,
    name: `dashboard-${new Date().toISOString().slice(0, 10)}`,
  });
  console.log(`tenant:  ${TENANT_ID}`);
  console.log(`api key: ${key.rawKey}`);
  console.log("\napps/dashboard/.env.local:");
  console.log("WORKSPACE_API_URL=http://localhost:8270");
  console.log(`WORKSPACE_API_KEY=${key.rawKey}`);
  console.log("WORKSPACE_DASHBOARD_USER=canis_ops");
} finally {
  await client.close();
}
