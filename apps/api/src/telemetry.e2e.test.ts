/**
 * /v1/telemetry e2e (card #52): anonymous ingest + aggregate summary. The
 * key thing under test besides the mechanics: nothing tenant- or
 * user-identifying reaches the summary, and unknown event names are refused
 * (the schema is the published one, not a general logger).
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

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5443/workspace_engine_test";

let app: INestApplication;
let httpServer: App;
let admin: WorkspaceDbClient;
const headers = { "x-api-key": "", "x-user-id": "user_tel" };

beforeAll(async () => {
  admin = createDbClient(TEST_DATABASE_URL);
  await admin.pool.query("select 1");
  const tenantId = `ten_${randomUUID()}`;
  await admin.db.insert(tenants).values({ id: tenantId, name: "Telemetry T" });
  headers["x-api-key"] = (
    await createApiKey(admin.db, { tenantId, name: "tel" })
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

describe("/v1/telemetry", () => {
  it("requires an API key (abuse gate) but persists nothing identifying", async () => {
    await request(httpServer)
      .post("/v1/telemetry")
      .send({ events: [{ event: "provider.mounted" }] })
      .expect(401);

    const res = await request(httpServer)
      .post("/v1/telemetry")
      .set(headers)
      .send({
        events: [
          {
            event: "provider.mounted",
            props: { devMode: true, contracts: 1 },
            sdkVersion: "0.1.0",
          },
          { event: "block.degraded", props: { reason: "fetch-error", blockType: "Graph" } },
        ],
      })
      .expect(202);
    expect(res.body.accepted).toBe(2);
  });

  it("refuses events outside the published schema", async () => {
    await request(httpServer)
      .post("/v1/telemetry")
      .set(headers)
      .send({ events: [{ event: "user.email_viewed", props: {} }] })
      .expect(400);
  });

  it("summarizes funnel + degradation reasons, no raw rows", async () => {
    const res = await request(httpServer)
      .get("/v1/telemetry/summary")
      .set(headers)
      .expect(200);
    const events = Object.fromEntries(
      (res.body.byEvent as { event: string; count: number }[]).map((e) => [
        e.event,
        e.count,
      ]),
    );
    expect(events["provider.mounted"]).toBeGreaterThanOrEqual(1);
    const reasons = Object.fromEntries(
      (res.body.degradedByReason as { reason: string; count: number }[]).map(
        (r) => [r.reason, r.count],
      ),
    );
    expect(reasons["fetch-error"]).toBeGreaterThanOrEqual(1);
    expect(JSON.stringify(res.body)).not.toContain("user_tel");
  });
});
