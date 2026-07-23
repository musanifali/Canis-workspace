/**
 * API-key scope enforcement ([review][P3]): a "runtime" key may drive the
 * SDK's own paths (workspaces, telemetry ingest, usage allowance/generation)
 * but is refused — machine-readable 403 `insufficient_key_scope` — on the
 * admin surface (contracts registry, audit, usage summary, telemetry
 * summary). An "admin" key holds every power. Keys minted without a scope
 * stay "admin" (pre-scope keys keep working).
 */
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { createApiKey, createDbClient, tenants } from "@workspace-engine/db";
import { randomUUID } from "node:crypto";
import request from "supertest";
import type { App } from "supertest/types";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "./app.module.js";
import { caseSpecBody, registerCaseContract } from "./e2e-support.js";

const TEST_DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5443/workspace_engine_test";

let app: INestApplication;
let httpServer: App;
let admin: ReturnType<typeof createDbClient>;
let runtimeKey: Record<string, string>;
let adminKey: Record<string, string>;
let unscopedKey: Record<string, string>;

beforeAll(async () => {
  admin = createDbClient(TEST_DATABASE_URL);
  await admin.pool.query("select 1");

  const tenantId = `ten_${randomUUID()}`;
  await admin.db
    .insert(tenants)
    .values([{ id: tenantId, name: "Scoped Tenant", slug: tenantId }]);
  await registerCaseContract(admin.db, tenantId);

  const runtime = await createApiKey(admin.db, {
    tenantId,
    name: "runtime",
    scope: "runtime",
  });
  const adminScoped = await createApiKey(admin.db, {
    tenantId,
    name: "admin",
    scope: "admin",
  });
  // No scope passed — must default to admin (pre-scope keys keep working).
  const unscoped = await createApiKey(admin.db, { tenantId, name: "legacy" });
  expect(unscoped.scope).toBe("admin");

  runtimeKey = { "x-api-key": runtime.rawKey, "x-user-id": "user_rt" };
  adminKey = { "x-api-key": adminScoped.rawKey, "x-user-id": "user_ad" };
  unscopedKey = { "x-api-key": unscoped.rawKey, "x-user-id": "user_lg" };

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

describe("runtime scope — SDK paths allowed", () => {
  it("saves and lists workspaces", async () => {
    const created = await request(httpServer)
      .post("/v1/workspaces")
      .set(runtimeKey)
      .send(caseSpecBody("Runtime save"))
      .expect(201);
    expect(created.body.id).toMatch(/^ws_/);
    await request(httpServer).get("/v1/workspaces").set(runtimeKey).expect(200);
  });

  it("ingests telemetry", async () => {
    await request(httpServer)
      .post("/v1/telemetry")
      .set(runtimeKey)
      .send({ events: [{ event: "provider.mounted", sdkVersion: "0.0.0" }] })
      .expect(202);
  });

  it("reads its usage allowance", async () => {
    await request(httpServer)
      .get("/v1/usage/allowance")
      .set(runtimeKey)
      .expect(200);
  });
});

describe("runtime scope — admin surface refused with insufficient_key_scope", () => {
  const expectScope403 = async (req: request.Test) => {
    const res = await req.expect(403);
    expect(res.body.code).toBe("insufficient_key_scope");
  };

  it("cannot register a contract", async () => {
    await expectScope403(
      request(httpServer)
        .put("/v1/contracts/case")
        .set(runtimeKey)
        .send({ definition: { name: "case" } }),
    );
  });

  it("cannot list or remove contracts", async () => {
    await expectScope403(
      request(httpServer).get("/v1/contracts").set(runtimeKey),
    );
    await expectScope403(
      request(httpServer).delete("/v1/contracts/case").set(runtimeKey),
    );
  });

  it("cannot read the audit trail", async () => {
    await expectScope403(request(httpServer).get("/v1/audit").set(runtimeKey));
  });

  it("cannot read usage or telemetry summaries", async () => {
    await expectScope403(
      request(httpServer).get("/v1/usage/summary").set(runtimeKey),
    );
    await expectScope403(
      request(httpServer).get("/v1/telemetry/summary").set(runtimeKey),
    );
  });
});

describe("admin + legacy (unscoped) keys — full surface", () => {
  it("admin key reaches contracts, audit, and summaries", async () => {
    await request(httpServer).get("/v1/contracts").set(adminKey).expect(200);
    await request(httpServer).get("/v1/audit").set(adminKey).expect(200);
    await request(httpServer)
      .get("/v1/telemetry/summary")
      .set(adminKey)
      .expect(200);
    await request(httpServer)
      .post("/v1/workspaces")
      .set(adminKey)
      .send(caseSpecBody("Admin save"))
      .expect(201);
  });

  it("a key minted before scopes existed still holds admin powers", async () => {
    await request(httpServer).get("/v1/contracts").set(unscopedKey).expect(200);
    await request(httpServer).get("/v1/audit").set(unscopedKey).expect(200);
  });
});
