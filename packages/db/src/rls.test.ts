/**
 * #25's acceptance criterion: the cross-tenant access suite that MUST FAIL —
 * every attempt by tenant B to read or write tenant A's rows is denied by
 * Postgres itself (RLS + grants + composite FKs), not by service-layer
 * politeness. Also proves the role separation (owner/admin vs
 * workspace_service) and that pooled connections cannot leak tenant scope
 * between transactions — the RLS-bypass class security-review.md §5 flags
 * as an open question for the vendored platform.
 */
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDbClient, type WorkspaceDbClient } from "./client.js";
import {
  auditLog,
  dataContracts,
  workspaces,
  workspaceVersions,
} from "./schema.js";
import { withTenant, type TenantContext } from "./tenant.js";
import {
  buildVerdict,
  connectTestDb,
  createTestTenant,
  expectDbErrorMatching,
  specFixture,
  TEST_DATABASE_URL,
} from "./test-helpers.js";
import { listAuditEntries } from "./operations/audit.js";
import { getDataContract, upsertDataContract } from "./operations/contracts.js";
import {
  createWorkspace,
  getWorkspace,
  listWorkspaces,
  listWorkspaceVersions,
  softDeleteWorkspace,
  updateWorkspaceSpec,
  WorkspaceNotFoundError,
} from "./operations/workspaces.js";

let client: WorkspaceDbClient;
let tenantA: TenantContext;
let tenantB: TenantContext;
let workspaceA: string;

beforeAll(async () => {
  client = await connectTestDb();
  ({ ctx: tenantA } = await createTestTenant(client, "Tenant A"));
  ({ ctx: tenantB } = await createTestTenant(client, "Tenant B"));

  const created = await withTenant(client.db, tenantA, (tx) =>
    createWorkspace(tx, tenantA, {
      spec: specFixture("A's board"),
      verdict: buildVerdict,
      prompt: "tenant A's secret prompt",
    }),
  );
  workspaceA = created.workspace.id;
  await withTenant(client.db, tenantA, (tx) =>
    upsertDataContract(tx, tenantA, {
      entityName: "case",
      definition: { entity: "case" },
    }),
  );
});

afterAll(async () => {
  await client?.close();
});

describe("RLS coverage (schema-level facts)", () => {
  it("every tenant table has RLS enabled", async () => {
    const rows = await client.db.execute<{
      relname: string;
      relrowsecurity: boolean;
    }>(sql`
      SELECT relname, relrowsecurity
      FROM pg_class
      WHERE relname IN ('tenants', 'workspaces', 'workspace_versions',
                        'workspace_shares', 'data_contracts', 'audit_log')
    `);
    expect(rows.rows).toHaveLength(6);
    for (const row of rows.rows) {
      expect(row.relrowsecurity, `${row.relname} must have RLS`).toBe(true);
    }
  });

  it("append-only tables have SELECT+INSERT policies only", async () => {
    const rows = await client.db.execute<{ tablename: string; cmd: string }>(
      sql`SELECT tablename, cmd FROM pg_policies
          WHERE tablename IN ('workspace_versions', 'audit_log')`,
    );
    const commands = new Set(rows.rows.map((r) => `${r.tablename}:${r.cmd}`));
    expect([...commands].toSorted()).toEqual([
      "audit_log:INSERT",
      "audit_log:SELECT",
      "workspace_versions:INSERT",
      "workspace_versions:SELECT",
    ]);
  });
});

describe("cross-tenant reads MUST FAIL", () => {
  it("tenant B cannot get tenant A's workspace", async () => {
    await expect(
      withTenant(client.db, tenantB, (tx) => getWorkspace(tx, tenantB, workspaceA)),
    ).rejects.toThrow(WorkspaceNotFoundError);
  });

  it("tenant B's list never contains tenant A's workspaces", async () => {
    const listed = await withTenant(client.db, tenantB, (tx) =>
      listWorkspaces(tx, tenantB),
    );
    expect(listed.map((w) => w.id)).not.toContain(workspaceA);
  });

  it("tenant B cannot enumerate tenant A's versions, even by direct select", async () => {
    await expect(
      withTenant(client.db, tenantB, (tx) =>
        listWorkspaceVersions(tx, tenantB, workspaceA),
      ),
    ).rejects.toThrow(WorkspaceNotFoundError);

    const raw = await withTenant(client.db, tenantB, (tx) =>
      tx
        .select()
        .from(workspaceVersions)
        .where(eq(workspaceVersions.workspaceId, workspaceA)),
    );
    expect(raw).toEqual([]);
  });

  it("tenant B cannot see tenant A's audit trail (or its prompts)", async () => {
    const entries = await withTenant(client.db, tenantB, (tx) =>
      listAuditEntries(tx, { workspaceId: workspaceA }),
    );
    expect(entries).toEqual([]);
  });

  it("tenant B cannot read tenant A's data contracts", async () => {
    const contract = await withTenant(client.db, tenantB, (tx) =>
      getDataContract(tx, "case"),
    );
    expect(contract).toBeNull();
  });
});

describe("cross-tenant writes MUST FAIL", () => {
  it("a forged insert claiming tenant A's tenant_id violates RLS", async () => {
    await expectDbErrorMatching(
      withTenant(client.db, tenantB, (tx) =>
        tx.insert(workspaces).values({
          id: `ws_${randomUUID()}`,
          tenantId: tenantA.tenantId,
          title: "forged",
          headVersion: 1,
          ownerUserId: tenantB.userId,
        }),
      ),
      /row-level security/,
    );
  });

  it("a version forged into tenant B but attached to tenant A's workspace violates the composite FK", async () => {
    await expectDbErrorMatching(
      withTenant(client.db, tenantB, (tx) =>
        tx.insert(workspaceVersions).values({
          id: `wsv_${randomUUID()}`,
          workspaceId: workspaceA,
          tenantId: tenantB.tenantId,
          versionNumber: 999,
          spec: specFixture("forged"),
          specVersion: 1,
          verdict: buildVerdict,
          authorUserId: tenantB.userId,
        }),
      ),
      /foreign key constraint/,
    );
  });

  it("an UPDATE aimed at tenant A's workspace hits zero rows", async () => {
    const updated = await withTenant(client.db, tenantB, (tx) =>
      tx
        .update(workspaces)
        .set({ title: "defaced" })
        .where(eq(workspaces.id, workspaceA))
        .returning({ id: workspaces.id }),
    );
    expect(updated).toEqual([]);

    const { workspace } = await withTenant(client.db, tenantA, (tx) =>
      getWorkspace(tx, tenantA, workspaceA),
    );
    expect(workspace.title).toBe("A's board");
  });

  it("update/delete via the operations layer report not-found", async () => {
    await expect(
      withTenant(client.db, tenantB, (tx) =>
        updateWorkspaceSpec(tx, tenantB, workspaceA, {
          spec: specFixture("hijacked"),
          verdict: buildVerdict,
        }),
      ),
    ).rejects.toThrow(WorkspaceNotFoundError);

    await expect(
      withTenant(client.db, tenantB, (tx) =>
        softDeleteWorkspace(tx, tenantB, workspaceA),
      ),
    ).rejects.toThrow(WorkspaceNotFoundError);
  });

  it("a forged audit entry for tenant A violates RLS", async () => {
    await expectDbErrorMatching(
      withTenant(client.db, tenantB, (tx) =>
        tx.insert(auditLog).values({
          tenantId: tenantA.tenantId,
          workspaceId: workspaceA,
          actorUserId: tenantB.userId,
          action: "workspace.viewed",
          detail: {},
        }),
      ),
      /row-level security/,
    );
  });
});

describe("service role vs owner role separation", () => {
  it("the service role without a tenant setting sees nothing (fail-closed)", async () => {
    // Two possible connection states, both closed: a fresh connection errors
    // (unset GUC), a reused one resolves current_setting to the reset value
    // '' which matches no tenant. Neither may return rows.
    const rows = await client.db
      .transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL ROLE workspace_service`);
        return await tx.select().from(workspaces);
      })
      .catch((error: unknown) => {
        expect(String(error)).toMatch(/configuration parameter/);
        return [];
      });
    expect(rows).toEqual([]);
  });

  it("the owner connection (admin path) sees across tenants — separation is real", async () => {
    const all = await client.db.select().from(workspaces);
    const tenantsSeen = new Set(all.map((w) => w.tenantId));
    expect(tenantsSeen.has(tenantA.tenantId)).toBe(true);
    // The service path above could never produce a multi-tenant result set.
  });
});

describe("pooled connections cannot leak tenant scope", () => {
  it("sequential transactions on ONE physical connection stay isolated", async () => {
    // max 1 connection: every transaction below reuses the same socket.
    const single = createDbClient(TEST_DATABASE_URL, { maxConnections: 1 });
    try {
      const asA = await withTenant(single.db, tenantA, (tx) =>
        listWorkspaces(tx, tenantA),
      );
      expect(asA.map((w) => w.id)).toContain(workspaceA);

      const asB = await withTenant(single.db, tenantB, (tx) =>
        listWorkspaces(tx, tenantB),
      );
      expect(asB.map((w) => w.id)).not.toContain(workspaceA);

      // After A's and B's transactions, the SAME connection carries no
      // residual tenant: the transaction-local setting reset to '' at each
      // COMMIT, so a service-role query without set_config matches no tenant
      // — B's scope (the last one used) must NOT bleed through.
      const residual = await single.db.transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL ROLE workspace_service`);
        const setting = await tx.execute<{ v: string | null }>(
          sql`SELECT current_setting('app.tenant_id', true) AS v`,
        );
        const rows = await tx.select().from(dataContracts);
        return { setting: setting.rows[0]?.v ?? null, rows };
      });
      expect(residual.setting ?? "").toBe("");
      expect(residual.rows).toEqual([]);
    } finally {
      await single.close();
    }
  });
});
