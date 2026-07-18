import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { WorkspaceDbClient } from "../client.js";
import { withTenant, type TenantContext } from "../tenant.js";
import { connectTestDb, createTestTenant } from "../test-helpers.js";
import { listAuditEntries, writeAudit } from "./audit.js";

let client: WorkspaceDbClient;
let ctx: TenantContext;

beforeAll(async () => {
  client = await connectTestDb();
  ({ ctx } = await createTestTenant(client, "Audit Tenant"));
  await withTenant(client.db, ctx, async (tx) => {
    await writeAudit(tx, ctx, { action: "workspace.created", workspaceId: "ws_a" });
    await writeAudit(tx, ctx, {
      action: "workspace.spec_rejected",
      detail: {
        verdict: "REJECT",
        errors: [
          {
            code: "UnknownEntityError",
            entity: "invoice",
            allowed: ["case"],
            message: 'unknown entity "invoice"',
          },
        ],
      },
    });
    await writeAudit(tx, ctx, { action: "workspace.updated", workspaceId: "ws_a" });
  });
});

afterAll(async () => {
  await client?.close();
});

describe("listAuditEntries action filter", () => {
  it("filters to one action, newest first", async () => {
    const rejected = await withTenant(client.db, ctx, (tx) =>
      listAuditEntries(tx, { action: "workspace.spec_rejected" }),
    );
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.action).toBe("workspace.spec_rejected");
    const detail = rejected[0]?.detail as { errors: { code: string }[] };
    expect(detail.errors[0]?.code).toBe("UnknownEntityError");
  });

  it("combines workspace and action filters", async () => {
    const rows = await withTenant(client.db, ctx, (tx) =>
      listAuditEntries(tx, { workspaceId: "ws_a", action: "workspace.updated" }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.action).toBe("workspace.updated");

    const none = await withTenant(client.db, ctx, (tx) =>
      listAuditEntries(tx, { workspaceId: "ws_a", action: "workspace.deleted" }),
    );
    expect(none).toHaveLength(0);
  });

  it("returns everything without filters", async () => {
    const all = await withTenant(client.db, ctx, (tx) => listAuditEntries(tx));
    expect(all.map((e) => e.action)).toEqual([
      "workspace.updated",
      "workspace.spec_rejected",
      "workspace.created",
    ]);
  });
});
