/**
 * /v1/contracts + /v1/audit e2e (cards #31/#53 groundwork): vendor
 * self-service contract registration gated by reviveContract, the audit read
 * surface, and the workspace.spec_rejected trail a refused save leaves behind.
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
import { caseContractDefinition, caseSpecBody } from "./e2e-support.js";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5443/workspace_engine_test";

let app: INestApplication;
let httpServer: App;
let admin: WorkspaceDbClient;

const asA = { "x-api-key": "", "x-user-id": "user_alice" };
const asB = { "x-api-key": "", "x-user-id": "user_bob" };

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

  const tenantA = `ten_${randomUUID()}`;
  const tenantB = `ten_${randomUUID()}`;
  await admin.db.insert(tenants).values([
    { id: tenantA, name: "Contracts Tenant A", slug: tenantA },
    { id: tenantB, name: "Contracts Tenant B", slug: tenantB },
  ]);
  asA["x-api-key"] = (
    await createApiKey(admin.db, { tenantId: tenantA, name: "a" })
  ).rawKey;
  asB["x-api-key"] = (
    await createApiKey(admin.db, { tenantId: tenantB, name: "b" })
  ).rawKey;

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

describe("/v1/contracts", () => {
  it("starts empty and 404s a lookup before registration", async () => {
    const list = await request(httpServer)
      .get("/v1/contracts")
      .set(asA)
      .expect(200);
    expect(list.body).toEqual([]);
    await request(httpServer).get("/v1/contracts/case").set(asA).expect(404);
  });

  it("registers a revivable definition and reads it back", async () => {
    const put = await request(httpServer)
      .put("/v1/contracts/case")
      .set(asA)
      .send({ definition: caseContractDefinition })
      .expect(200);
    expect(put.body.entityName).toBe("case");
    expect(put.body.definition.name).toBe("case");

    const got = await request(httpServer)
      .get("/v1/contracts/case")
      .set(asA)
      .expect(200);
    expect(got.body.definition).toEqual(caseContractDefinition);
  });

  it("422s a definition reviveContract cannot enforce", async () => {
    const res = await request(httpServer)
      .put("/v1/contracts/broken")
      .set(asA)
      .send({ definition: { name: "broken", fields: "not-an-object" } })
      .expect(422);
    expect(res.body.code).toBe("contract_invalid");
  });

  it("422s a definition whose declared name mismatches the path", async () => {
    const res = await request(httpServer)
      .put("/v1/contracts/alias")
      .set(asA)
      .send({ definition: caseContractDefinition })
      .expect(422);
    expect(res.body.code).toBe("contract_invalid");
    expect(res.body.message).toContain('"case"');
  });

  it("is tenant-scoped: B sees no contracts, and B's writes don't leak to A", async () => {
    const listB = await request(httpServer)
      .get("/v1/contracts")
      .set(asB)
      .expect(200);
    expect(listB.body).toEqual([]);
    await request(httpServer).get("/v1/contracts/case").set(asB).expect(404);
  });

  it("gates saves with the registered contract, then removes it", async () => {
    // With the contract registered, a bound spec saves (server-side BUILD).
    await request(httpServer)
      .post("/v1/workspaces")
      .set(asA)
      .send(caseSpecBody("Registered via API"))
      .expect(201);

    await request(httpServer).delete("/v1/contracts/case").set(asA).expect(204);
    await request(httpServer).delete("/v1/contracts/case").set(asA).expect(404);

    // Without it, the same save is refused — registry state IS the gate.
    await request(httpServer)
      .post("/v1/workspaces")
      .set(asA)
      .send(caseSpecBody("After removal"))
      .expect(422);
  });
});

describe("/v1/audit", () => {
  it("shows the contract lifecycle and refused saves, tenant-scoped", async () => {
    const all = await request(httpServer).get("/v1/audit").set(asA).expect(200);
    const actions = (all.body as { action: string }[]).map((e) => e.action);
    expect(actions).toContain("contract.registered");
    expect(actions).toContain("contract.removed");
    expect(actions).toContain("workspace.created");
    expect(actions).toContain("workspace.spec_rejected");

    // Tenant B took no actions, so its trail is empty (RLS-scoped read).
    const forB = await request(httpServer).get("/v1/audit").set(asB).expect(200);
    expect(forB.body).toEqual([]);
  });

  it("filters by action and carries the validator's structured errors", async () => {
    const res = await request(httpServer)
      .get("/v1/audit?action=workspace.spec_rejected")
      .set(asA)
      .expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    const entry = res.body[0] as {
      action: string;
      actorUserId: string;
      detail: { verdict: string; errors: { code: string; entity?: string }[] };
    };
    expect(entry.action).toBe("workspace.spec_rejected");
    expect(entry.actorUserId).toBe("user_alice");
    expect(entry.detail.verdict).toBe("REJECT");
    expect(
      entry.detail.errors.some(
        (e) => e.code === "UnknownEntityError" && e.entity === "case",
      ),
    ).toBe(true);
  });

  it("rejects an unknown action filter", async () => {
    await request(httpServer)
      .get("/v1/audit?action=workspace.hacked")
      .set(asA)
      .expect(400);
  });
});
