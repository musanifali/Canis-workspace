/**
 * /v1/usage contract tests (#48): budgets/rate limits enforced with a
 * machine-readable 429 (clear user-facing state), cost visible per
 * workspace, reads free.
 */
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  createHttpWorkspaceStore,
  createWorkspaceServiceClient,
  GenerationLimitedError,
} from "@workspace-engine/client";
import {
  createApiKey,
  createDbClient,
  setTenantLimits,
  tenants,
  type WorkspaceDbClient,
} from "@workspace-engine/db";
import { randomUUID } from "node:crypto";
import request from "supertest";
import type { App } from "supertest/types.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "./app.module.js";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5443/workspace_engine_test";

let app: INestApplication;
let httpServer: App;
let admin: WorkspaceDbClient;
let tenantId: string;
let headers: Record<string, string>;
let baseUrl: string;

beforeAll(async () => {
  admin = createDbClient(TEST_DATABASE_URL);
  tenantId = `ten_${randomUUID()}`;
  await admin.db
    .insert(tenants)
    .values({ id: tenantId, name: "Usage API Tenant", slug: tenantId });
  const key = await createApiKey(admin.db, { tenantId, name: "usage" });
  headers = { "x-api-key": key.rawKey, "x-user-id": "user_usage" };

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.forDatabase(TEST_DATABASE_URL)],
  }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix("v1");
  await app.listen(0);
  httpServer = app.getHttpServer() as App;
  baseUrl = await app.getUrl();
});

afterAll(async () => {
  await app?.close();
  await admin?.close();
});

describe("/v1/usage", () => {
  it("allowance starts open with an unlimited budget", async () => {
    const response = await request(httpServer)
      .get("/v1/usage/allowance")
      .set(headers)
      .expect(200);
    expect(response.body.allowed).toBe(true);
    expect(response.body.remainingThisMonth).toBeNull();
  });

  it("budget exhaustion returns a machine-readable 429, and the summary sees the spend", async () => {
    await setTenantLimits(admin.db, tenantId, { monthlyGenerationBudget: 2 });

    await request(httpServer)
      .post("/v1/usage/generation")
      .set(headers)
      .send({ costCents: 4 })
      .expect(201);
    const second = await request(httpServer)
      .post("/v1/usage/generation")
      .set(headers)
      .send({ costCents: 6 })
      .expect(201);
    expect(second.body.allowance.remainingThisMonth).toBe(0);

    const denied = await request(httpServer)
      .post("/v1/usage/generation")
      .set(headers)
      .send({})
      .expect(429);
    expect(denied.body.code).toBe("budget_exceeded");
    expect(denied.body.message).toContain("budget");

    const summary = await request(httpServer)
      .get("/v1/usage/summary")
      .set(headers)
      .expect(200);
    expect(summary.body.month).toEqual({ generations: 2, costCents: 10 });
    expect(summary.body.readCostCents).toBe(0);
  });

  it("the typed client surfaces the denial as GenerationLimitedError", async () => {
    const client = createWorkspaceServiceClient({
      baseUrl,
      apiKey: headers["x-api-key"] as string,
      userId: "user_usage",
    });
    await expect(client.recordGeneration()).rejects.toThrow(
      GenerationLimitedError,
    );
    const allowance = await client.getGenerationAllowance();
    expect(allowance).toMatchObject({ allowed: false, reason: "budget_exceeded" });
  });

  it("reads over the store never consume allowance", async () => {
    // Budget is exhausted, yet the workspace surface still works fully.
    const store = createHttpWorkspaceStore({
      baseUrl,
      apiKey: headers["x-api-key"] as string,
      userId: "user_usage",
    });
    const listed = await store.list();
    expect(Array.isArray(listed)).toBe(true);
  });
});
