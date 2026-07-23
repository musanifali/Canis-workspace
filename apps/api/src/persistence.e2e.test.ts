/**
 * Phase 4's definition-of-done headline for persistence: a saved workspace
 * survives ACROSS PROCESSES — created through one service instance, read
 * back through a completely separate one. Not a browser, not a shared
 * in-memory map: Postgres.
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

let admin: WorkspaceDbClient;
let headers: Record<string, string>;

async function bootInstance(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.forDatabase(TEST_DATABASE_URL)],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix("v1");
  await app.init();
  return app;
}

beforeAll(async () => {
  admin = createDbClient(TEST_DATABASE_URL);
  const tenantId = `ten_${randomUUID()}`;
  await admin.db
    .insert(tenants)
    .values({ id: tenantId, name: "Persistence Tenant", slug: tenantId });
  await registerCaseContract(admin.db, tenantId);
  const key = await createApiKey(admin.db, { tenantId, name: "persist" });
  headers = { "x-api-key": key.rawKey, "x-user-id": "user_persist" };
});

afterAll(async () => {
  await admin?.close();
});

describe("persistence across processes", () => {
  it("a workspace saved via instance A is served by instance B after A is gone", async () => {
    const instanceA = await bootInstance();
    const created = await request(instanceA.getHttpServer() as App)
      .post("/v1/workspaces")
      .set(headers)
      .send({ spec: caseSpec("Survives the process") })
      .expect(201);
    await instanceA.close();

    const instanceB = await bootInstance();
    try {
      const fetched = await request(instanceB.getHttpServer() as App)
        .get(`/v1/workspaces/${created.body.id}`)
        .set(headers)
        .expect(200);
      expect(fetched.body.title).toBe("Survives the process");
      expect(fetched.body.spec.blocks).toHaveLength(1);
    } finally {
      await instanceB.close();
    }
  });
});
