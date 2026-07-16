/**
 * #27's core guarantee, proven against the database rather than the code:
 * versions and audit entries are append-only. The service role has no
 * UPDATE/DELETE privilege on these tables (migration 0002), so tampering is
 * a hard "permission denied" — not a silently filtered 0-row no-op, and not
 * merely "the operations layer doesn't expose it".
 */
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { WorkspaceDbClient } from "../client.js";
import { auditLog, workspaceVersions } from "../schema.js";
import { withTenant, type TenantContext } from "../tenant.js";
import {
  buildVerdict,
  connectTestDb,
  createTestTenant,
  specFixture,
} from "../test-helpers.js";
import { createWorkspace } from "./workspaces.js";

let client: WorkspaceDbClient;
let ctx: TenantContext;
let workspaceId: string;
let versionId: string;

/**
 * Drizzle wraps driver errors ("Failed query: …" with the pg error as
 * `cause`); assert the underlying Postgres permission failure.
 */
async function expectPermissionDenied(run: Promise<unknown>): Promise<void> {
  const error = await run.then(
    () => null,
    (thrown: unknown) => thrown,
  );
  expect(error).toBeInstanceOf(Error);
  const chain: string[] = [];
  let current: unknown = error;
  while (current instanceof Error) {
    chain.push(current.message);
    current = current.cause;
  }
  expect(chain.join(" | ")).toMatch(/permission denied/);
}

beforeAll(async () => {
  client = await connectTestDb();
  ({ ctx } = await createTestTenant(client, "Immutability Tenant"));
  const created = await withTenant(client.db, ctx, (tx) =>
    createWorkspace(tx, ctx, {
      spec: specFixture("Untouchable"),
      verdict: buildVerdict,
      prompt: "original prompt",
    }),
  );
  workspaceId = created.workspace.id;
  versionId = created.head.id;
});

afterAll(async () => {
  await client?.close();
});

describe("workspace_versions is append-only for the service role", () => {
  it("denies UPDATE outright", async () => {
    await expectPermissionDenied(
      withTenant(client.db, ctx, (tx) =>
        tx
          .update(workspaceVersions)
          .set({ prompt: "tampered" })
          .where(eq(workspaceVersions.id, versionId)),
      ),
    );
  });

  it("denies DELETE outright", async () => {
    await expectPermissionDenied(
      withTenant(client.db, ctx, (tx) =>
        tx
          .delete(workspaceVersions)
          .where(eq(workspaceVersions.id, versionId)),
      ),
    );
  });

  it("denies raw-SQL UPDATE too (not a query-builder artifact)", async () => {
    await expectPermissionDenied(
      withTenant(client.db, ctx, (tx) =>
        tx.execute(
          sql`UPDATE workspace_versions SET prompt = 'tampered' WHERE id = ${versionId}`,
        ),
      ),
    );
  });

  it("the version is untouched after the attempts", async () => {
    const [version] = await withTenant(client.db, ctx, (tx) =>
      tx
        .select()
        .from(workspaceVersions)
        .where(eq(workspaceVersions.id, versionId)),
    );
    expect(version?.prompt).toBe("original prompt");
  });
});

describe("audit_log is append-only for the service role", () => {
  it("denies UPDATE outright", async () => {
    await expectPermissionDenied(
      withTenant(client.db, ctx, (tx) =>
        tx
          .update(auditLog)
          .set({ action: "workspace.viewed" })
          .where(eq(auditLog.workspaceId, workspaceId)),
      ),
    );
  });

  it("denies DELETE outright", async () => {
    await expectPermissionDenied(
      withTenant(client.db, ctx, (tx) =>
        tx.delete(auditLog).where(eq(auditLog.workspaceId, workspaceId)),
      ),
    );
  });
});
