/**
 * Plan tiers (#94) over /v1: a free tenant hits the free generation cap and
 * gets the existing machine-readable 429; a pro tenant sails past the same
 * load; and a plan change (raw SQL, no restart) takes effect on the next call.
 * Enforcement is the SAME /v1/usage path as #48 — plans just move the cap.
 */
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { PLAN_CAPS } from "@workspace-engine/core";
import {
  createApiKey,
  createDbClient,
  provisionTenant,
  tenants,
  usageEvents,
} from "@workspace-engine/db";
import { eq } from "drizzle-orm";
import request from "supertest";
import type { App } from "supertest/types";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "./app.module.js";

const TEST_DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5443/workspace_engine_test";
const uniq = () => Math.random().toString(36).slice(2, 9);
const FREE = PLAN_CAPS.free.generationsPerMonth!;

let app: INestApplication;
let httpServer: App;
let admin: ReturnType<typeof createDbClient>;

async function freshTenant() {
  const p = await provisionTenant(admin.db, {
    orgName: "Plan API",
    slug: `planapi-${uniq()}`,
    owner: { externalId: `github:${uniq()}` },
  });
  const key = await createApiKey(admin.db, {
    tenantId: p.tenant.id,
    name: "runtime",
    scope: "runtime",
  });
  return {
    tenantId: p.tenant.id,
    headers: { "x-api-key": key.rawKey, "x-user-id": p.owner.id },
  };
}

/**
 * Pre-fill the month's ledger to `n` generations (owner conn bypasses RLS).
 * Backdated 5 minutes so the fill counts toward the MONTHLY budget but not the
 * per-user 1-minute rate window — this test is about the plan cap, not rate.
 */
async function fillGenerations(tenantId: string, userId: string, n: number) {
  if (n <= 0) return;
  const backdated = new Date(Date.now() - 5 * 60 * 1000);
  await admin.db.insert(usageEvents).values(
    Array.from({ length: n }, () => ({
      tenantId,
      userId,
      kind: "generation" as const,
      costCents: 0,
      createdAt: backdated,
    })),
  );
}

beforeAll(async () => {
  admin = createDbClient(TEST_DATABASE_URL);
  await admin.pool.query("select 1");
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

describe("free tier hits the generation cap", () => {
  it("allowance reflects the free cap, and exhausting it returns 429 budget_exceeded", async () => {
    const { tenantId, headers } = await freshTenant(); // signup → free
    const allow = await request(httpServer).get("/v1/usage/allowance").set(headers).expect(200);
    expect(allow.body.plan).toBe("free");
    expect(allow.body.monthlyCap).toBe(FREE);

    // Pre-fill to one below the cap, then the last one is allowed…
    await fillGenerations(tenantId, headers["x-user-id"], FREE - 1);
    await request(httpServer).post("/v1/usage/generation").set(headers).send({}).expect(201);
    // …and the next crosses it: the existing machine-readable 429.
    const denied = await request(httpServer)
      .post("/v1/usage/generation")
      .set(headers)
      .send({})
      .expect(429);
    expect(denied.body.code).toBe("budget_exceeded");
  });
});

describe("pro tier passes the same load", () => {
  it("a pro tenant is not blocked at the free cap", async () => {
    const { tenantId, headers } = await freshTenant();
    await admin.db.update(tenants).set({ plan: "pro" }).where(eq(tenants.id, tenantId));

    // The same fill that exhausted free is nowhere near the pro cap.
    await fillGenerations(tenantId, headers["x-user-id"], FREE);
    const allow = await request(httpServer).get("/v1/usage/allowance").set(headers).expect(200);
    expect(allow.body.plan).toBe("pro");
    expect(allow.body.allowed).toBe(true);
    await request(httpServer).post("/v1/usage/generation").set(headers).send({}).expect(201);
  });
});

describe("plan change takes effect without a restart", () => {
  it("upgrading a capped free tenant to pro immediately reopens generation", async () => {
    const { tenantId, headers } = await freshTenant();
    await fillGenerations(tenantId, headers["x-user-id"], FREE);
    await request(httpServer).post("/v1/usage/generation").set(headers).send({}).expect(429);

    // Admin/SQL plan change — no deploy, no restart.
    await admin.db.update(tenants).set({ plan: "pro" }).where(eq(tenants.id, tenantId));

    const allow = await request(httpServer).get("/v1/usage/allowance").set(headers).expect(200);
    expect(allow.body.allowed).toBe(true);
    await request(httpServer).post("/v1/usage/generation").set(headers).send({}).expect(201);
  });
});
