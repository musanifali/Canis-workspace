/**
 * Provision the Canis-internal dashboard tenant + an API key (#53 dogfooding),
 * and — for #93 login — an owner user bound to that tenant. Admin operation
 * only; contracts and workspaces are NOT seeded here (the dashboard registers
 * those through the public /v1 API like any vendor).
 *
 * Usage:  GITHUB_OWNER_ID=<your github numeric id> node scripts/seed-dashboard-tenant.mjs
 * Find your id at https://api.github.com/users/<handle>. Then put the printed
 * values in apps/dashboard/.env.local and log in with that GitHub account.
 */
import { randomUUID } from "node:crypto";
import { createApiKey, createDbClient, tenants, users } from "@workspace-engine/db";

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5443/workspace_engine";
const TENANT_ID = "ten_canis_internal";
const GITHUB_OWNER_ID = process.env.GITHUB_OWNER_ID;

const client = createDbClient(DATABASE_URL);
try {
  await client.db
    .insert(tenants)
    .values({
      id: TENANT_ID,
      name: "Canis Internal (dashboard)",
      slug: "canis-internal",
    })
    .onConflictDoNothing();
  // Admin scope: the dashboard reads contracts/audit/summaries, and its key
  // never leaves the server (GET-only proxy) — the exact credential split the
  // key-scope model exists for ([review][P3]).
  const key = await createApiKey(client.db, {
    tenantId: TENANT_ID,
    name: `dashboard-${new Date().toISOString().slice(0, 10)}`,
    scope: "admin",
  });

  // #93: an owner user so a real person can log in to this tenant's dashboard.
  if (GITHUB_OWNER_ID) {
    await client.db
      .insert(users)
      .values({
        id: `usr_${randomUUID()}`,
        tenantId: TENANT_ID,
        externalId: `github:${GITHUB_OWNER_ID}`,
        role: "owner",
      })
      .onConflictDoNothing();
  }

  console.log(`tenant:  ${TENANT_ID}`);
  console.log(`api key: ${key.rawKey} (scope: admin)`);
  if (!GITHUB_OWNER_ID) {
    console.log(
      "\n⚠  No GITHUB_OWNER_ID given — no login user created. Re-run with " +
        "GITHUB_OWNER_ID=<your github numeric id> to enable dashboard login.",
    );
  }
  console.log("\napps/dashboard/.env.local:");
  console.log("WORKSPACE_API_URL=http://localhost:8270");
  console.log(`WORKSPACE_API_KEY=${key.rawKey}`);
  console.log(`WORKSPACE_TENANT_ID=${TENANT_ID}`);
} finally {
  await client.close();
}
