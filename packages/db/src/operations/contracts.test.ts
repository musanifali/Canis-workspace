import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { WorkspaceDbClient } from "../client.js";
import { withTenant, type TenantContext } from "../tenant.js";
import { connectTestDb, createTestTenant } from "../test-helpers.js";
import { listAuditEntries } from "./audit.js";
import {
  getDataContract,
  listDataContracts,
  removeDataContract,
  upsertDataContract,
} from "./contracts.js";

let client: WorkspaceDbClient;
let ctx: TenantContext;

const caseDefinition = {
  entity: "case",
  fields: { id: { kind: "string" }, risk: { kind: "enum" } },
};

beforeAll(async () => {
  client = await connectTestDb();
  ({ ctx } = await createTestTenant(client, "Contracts Tenant"));
});

afterAll(async () => {
  await client?.close();
});

describe("upsertDataContract", () => {
  it("registers a new contract and audits it", async () => {
    const contract = await withTenant(client.db, ctx, (tx) =>
      upsertDataContract(tx, ctx, {
        entityName: "case",
        definition: caseDefinition,
      }),
    );
    expect(contract.entityName).toBe("case");
    expect(contract.definition).toEqual(caseDefinition);

    const audit = await withTenant(client.db, ctx, (tx) =>
      listAuditEntries(tx),
    );
    expect(audit[0]?.action).toBe("contract.registered");
  });

  it("updates an existing contract in place (same row, new definition)", async () => {
    const revised = { ...caseDefinition, fields: { id: { kind: "string" } } };
    const updated = await withTenant(client.db, ctx, (tx) =>
      upsertDataContract(tx, ctx, {
        entityName: "case",
        definition: revised,
      }),
    );
    expect(updated.definition).toEqual(revised);

    const all = await withTenant(client.db, ctx, (tx) =>
      listDataContracts(tx),
    );
    expect(all).toHaveLength(1);

    const audit = await withTenant(client.db, ctx, (tx) =>
      listAuditEntries(tx),
    );
    expect(audit[0]?.action).toBe("contract.updated");
  });
});

describe("getDataContract / removeDataContract", () => {
  it("returns null for an unregistered entity", async () => {
    const missing = await withTenant(client.db, ctx, (tx) =>
      getDataContract(tx, "invoice"),
    );
    expect(missing).toBeNull();
  });

  it("removes a contract and reports whether one existed", async () => {
    const removed = await withTenant(client.db, ctx, (tx) =>
      removeDataContract(tx, ctx, "case"),
    );
    expect(removed).toBe(true);

    const again = await withTenant(client.db, ctx, (tx) =>
      removeDataContract(tx, ctx, "case"),
    );
    expect(again).toBe(false);

    const audit = await withTenant(client.db, ctx, (tx) =>
      listAuditEntries(tx),
    );
    expect(audit[0]?.action).toBe("contract.removed");
  });
});
