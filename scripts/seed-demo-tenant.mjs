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
import { createApiKey, createDbClient, tenants } from "@workspace-engine/db";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5443/workspace_engine";
const TENANT_ID = "ten_demo";

const client = createDbClient(DATABASE_URL);
try {
  await client.db
    .insert(tenants)
    .values({ id: TENANT_ID, name: "Canis Demo" })
    .onConflictDoNothing();
  const key = await createApiKey(client.db, {
    tenantId: TENANT_ID,
    name: `demo-${new Date().toISOString().slice(0, 10)}`,
  });
  console.log(`tenant:  ${TENANT_ID}`);
  console.log(`api key: ${key.rawKey}`);
  console.log("\ndemo/.env.local:");
  console.log("NEXT_PUBLIC_WORKSPACE_API_URL=http://localhost:8270");
  console.log(`NEXT_PUBLIC_WORKSPACE_API_KEY=${key.rawKey}`);
} finally {
  await client.close();
}
