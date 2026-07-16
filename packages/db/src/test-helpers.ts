/**
 * Shared fixtures for the integration suite. These tests need the dedicated
 * Postgres container (docker-compose.yml) and FAIL LOUDLY when it's down —
 * a skipped DB suite that reports green is the vacuous-pass trap the eval
 * harness already fell into once (review card HYVbv9k5).
 */
import type { WorkspaceSpec } from "@workspace-engine/core";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createDbClient, type WorkspaceDbClient } from "./client.js";
import { tenants } from "./schema.js";
import type { TenantContext } from "./tenant.js";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5443/workspace_engine_test";

/**
 * Connect to the test database and bring it to the current migration state.
 * @returns A pooled client the test file must close in afterAll.
 */
export async function connectTestDb(): Promise<WorkspaceDbClient> {
  const client = createDbClient(TEST_DATABASE_URL);
  try {
    await client.pool.query("select 1");
  } catch (error) {
    await client.close();
    throw new Error(
      `Workspace Service test Postgres is unreachable at ${TEST_DATABASE_URL}.\n` +
        `Start it with: npm run db:up -w @workspace-engine/db\n` +
        `(underlying error: ${error instanceof Error ? error.message : String(error)})`,
    );
  }
  await migrate(client.db, {
    migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)),
  });
  return client;
}

/**
 * Create a fresh tenant (admin connection — tenant provisioning is an
 * owner-side operation, like in prod). Unique ids isolate test files from
 * each other without truncation.
 * @returns The tenant id plus a ready-made TenantContext for a user in it.
 */
export async function createTestTenant(
  client: WorkspaceDbClient,
  name = "Test Tenant",
): Promise<{ tenantId: string; ctx: TenantContext }> {
  const tenantId = `ten_${randomUUID()}`;
  await client.db.insert(tenants).values({ id: tenantId, name });
  return {
    tenantId,
    ctx: { tenantId, userId: `user_${randomUUID().slice(0, 8)}` },
  };
}

/**
 * Minimal shape-valid Spec v1 document (one static block). Contract-level
 * validity is the validator's concern upstream of the store; persistence
 * asserts shape via the canonical parseSpec round-trip.
 * @returns A fresh spec object (safe to mutate in tests).
 */
export function specFixture(title = "Cases overview"): WorkspaceSpec {
  return {
    specVersion: 1,
    title,
    timezone: "viewer",
    refresh: { mode: "manual" },
    layout: { columns: 12 },
    blocks: [
      {
        id: "blk_a1",
        type: "NoteCard",
        frame: { x: 0, y: 0, w: 6, h: 4 },
        config: { text: "hello" },
        binding: null,
      },
    ],
  };
}

/** The verdict a save-gated spec is stored with. */
export const buildVerdict = { verdict: "BUILD", notes: [] } as const;
