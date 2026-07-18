/**
 * Card #87 — the stored audit verdict is server-computed, and non-BUILD specs
 * cannot be persisted.
 *
 * The service re-runs core's `validateSpec` against the tenant's registered
 * `data_contracts` on every create/update, stores the REAL verdict (not a
 * client-asserted one), and refuses any CLARIFY/REJECT with a machine-readable
 * 422 — writing nothing. These tests drive the real guard, controller,
 * service, operations layer, and RLS, and read the stored verdict straight
 * from Postgres (it is not exposed over HTTP).
 */
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  createApiKey,
  createDbClient,
  tenants,
  type WorkspaceDbClient,
} from "@workspace-engine/db";
import { randomUUID } from "node:crypto";
import request from "supertest";
import type { App } from "supertest/types.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "./app.module.js";
import { caseSpec, registerCaseContract } from "./e2e-support.js";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5443/workspace_engine_test";

let app: INestApplication;
let httpServer: App;
let admin: WorkspaceDbClient;
/** Tenant WITH the `case` contract registered. */
let withContract: Record<string, string>;
/** Tenant WITHOUT any contracts. */
let noContract: Record<string, string>;

/** A CasesTable bound to `case` whose date filter forces a truncation note. */
function noteProducingSpec(title: string) {
  const spec = caseSpec(title);
  spec.blocks[0]!.binding = {
    entity: "case",
    query: {
      filters: [{ field: "dueDate", op: "before", value: { abs: "2026-03-15T09:30:00Z" } }],
      sort: [],
    },
  } as (typeof spec.blocks)[0]["binding"];
  return spec;
}

/** A spec binding an undeclared field on `case` — the validator must REJECT. */
function outOfContractFieldSpec(title: string) {
  const spec = caseSpec(title);
  spec.blocks[0]!.binding = {
    entity: "case",
    query: { filters: [{ field: "ssn", op: "eq", value: "123" }], sort: [] },
  } as (typeof spec.blocks)[0]["binding"];
  return spec;
}

/** A spec binding an entity the tenant never declared — the validator REJECTs. */
function unknownEntitySpec(title: string) {
  const spec = caseSpec(title);
  spec.blocks[0]!.binding = {
    entity: "invoice",
    query: { filters: [], sort: [] },
  } as (typeof spec.blocks)[0]["binding"];
  return spec;
}

async function storedVerdict(workspaceId: string): Promise<{
  verdict: string;
  notes: unknown[];
}> {
  const { rows } = await admin.pool.query(
    "select verdict from workspace_versions where workspace_id = $1 order by version_number desc limit 1",
    [workspaceId],
  );
  return rows[0]?.verdict as { verdict: string; notes: unknown[] };
}

async function versionCount(workspaceId: string): Promise<number> {
  const { rows } = await admin.pool.query(
    "select count(*)::int as n from workspace_versions where workspace_id = $1",
    [workspaceId],
  );
  return rows[0]?.n as number;
}

beforeAll(async () => {
  admin = createDbClient(TEST_DATABASE_URL);
  try {
    await admin.pool.query("select 1");
  } catch (error) {
    throw new Error(
      `Test Postgres unreachable at ${TEST_DATABASE_URL} — start it with ` +
        `npm run db:up -w @workspace-engine/db (${String(error)})`,
    );
  }

  const tenantWith = `ten_${randomUUID()}`;
  const tenantWithout = `ten_${randomUUID()}`;
  await admin.db.insert(tenants).values([
    { id: tenantWith, name: "Contracted Tenant" },
    { id: tenantWithout, name: "Contractless Tenant" },
  ]);
  await registerCaseContract(admin.db, tenantWith);
  const keyWith = (await createApiKey(admin.db, { tenantId: tenantWith, name: "w" })).rawKey;
  const keyWithout = (await createApiKey(admin.db, { tenantId: tenantWithout, name: "n" })).rawKey;
  withContract = { "x-api-key": keyWith, "x-user-id": "user_w" };
  noContract = { "x-api-key": keyWithout, "x-user-id": "user_n" };

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.forDatabase(TEST_DATABASE_URL)],
  }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix("v1");
  await app.init();
  httpServer = app.getHttpServer() as App;
});

afterAll(async () => {
  await app?.close();
  await admin?.close();
});

describe("server-computed verdict on create", () => {
  it("stores the REAL validator verdict (notes prove it ran, not a stub)", async () => {
    const created = await request(httpServer)
      .post("/v1/workspaces")
      .set(withContract)
      .send({ spec: noteProducingSpec("In-contract board") })
      .expect(201);

    const stored = await storedVerdict(created.body.id as string);
    expect(stored.verdict).toBe("BUILD");
    // The date-truncation note can only exist if the server actually ran
    // validateSpec — the old hardcoded verdict always stored notes: [].
    expect(stored.notes.length).toBeGreaterThan(0);
  });

  it("rejects an out-of-contract FIELD with a machine-readable 422 and persists nothing", async () => {
    const before = await request(httpServer)
      .get("/v1/workspaces")
      .set(withContract)
      .expect(200);

    const rejected = await request(httpServer)
      .post("/v1/workspaces")
      .set(withContract)
      .send({ spec: outOfContractFieldSpec("Exfiltration attempt") })
      .expect(422);
    expect(rejected.body.code).toBe("spec_rejected");
    expect(rejected.body.verdict).toBe("REJECT");
    expect(Array.isArray(rejected.body.errors)).toBe(true);
    expect(rejected.body.errors.length).toBeGreaterThan(0);

    // Nothing persisted: the workspace list is unchanged.
    const after = await request(httpServer)
      .get("/v1/workspaces")
      .set(withContract)
      .expect(200);
    expect(after.body.length).toBe(before.body.length);
  });

  it("rejects an unknown ENTITY (no contract for it) with a 422", async () => {
    const rejected = await request(httpServer)
      .post("/v1/workspaces")
      .set(withContract)
      .send({ spec: unknownEntitySpec("Unknown entity") })
      .expect(422);
    expect(rejected.body.code).toBe("spec_rejected");
    expect(JSON.stringify(rejected.body.errors)).toContain("invoice");
  });
});

describe("server-computed verdict on update", () => {
  it("a valid create then an out-of-contract update: 422 and NO new version", async () => {
    const created = await request(httpServer)
      .post("/v1/workspaces")
      .set(withContract)
      .send({ spec: caseSpec("Editable board") })
      .expect(201);
    const id = created.body.id as string;
    expect(await versionCount(id)).toBe(1);

    await request(httpServer)
      .put(`/v1/workspaces/${id}`)
      .set(withContract)
      .send({ spec: outOfContractFieldSpec("hijack via edit") })
      .expect(422);

    // Head unmoved, no new immutable version appended.
    expect(await versionCount(id)).toBe(1);
    const fetched = await request(httpServer)
      .get(`/v1/workspaces/${id}`)
      .set(withContract)
      .expect(200);
    expect(fetched.body.headVersion).toBe(1);
    expect(fetched.body.title).toBe("Editable board");

    // A valid edit still succeeds and stores its real verdict.
    const updated = await request(httpServer)
      .put(`/v1/workspaces/${id}`)
      .set(withContract)
      .send({ spec: noteProducingSpec("Editable board v2") })
      .expect(200);
    expect(updated.body.headVersion).toBe(2);
    expect((await storedVerdict(id)).notes.length).toBeGreaterThan(0);
  });
});

describe("tenant without any contracts", () => {
  it("cannot save a bound spec — every entity is out-of-contract (422)", async () => {
    const rejected = await request(httpServer)
      .post("/v1/workspaces")
      .set(noContract)
      .send({ spec: caseSpec("No contracts here") })
      .expect(422);
    expect(rejected.body.code).toBe("spec_rejected");

    const list = await request(httpServer)
      .get("/v1/workspaces")
      .set(noContract)
      .expect(200);
    expect(list.body.length).toBe(0);
  });
});
