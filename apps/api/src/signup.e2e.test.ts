/**
 * Tenant self-signup (#91). The one /v1 route with no TenantGuard: it
 * provisions a tenant + owner + admin key from a verified identity, gated by
 * the shared provisioning secret the dashboard BFF holds. Covers the card's
 * ACs: cold signup lands a tenant with RLS-usable rows, idempotent replay,
 * duplicate-slug rejection, disposable-email rejection, and the secret gate.
 */
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { createDbClient } from "@workspace-engine/db";
import request from "supertest";
import type { App } from "supertest/types";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "./app.module.js";

const TEST_DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5443/workspace_engine_test";

const PROVISION_SECRET = "test-provision-secret";

let app: INestApplication;
let httpServer: App;
let admin: ReturnType<typeof createDbClient>;

// Unique per run so repeat local runs don't collide on global slug/externalId.
const uniq = () => Math.random().toString(36).slice(2, 9);

beforeAll(async () => {
  process.env.WORKSPACE_PROVISION_SECRET = PROVISION_SECRET;
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

// Each request gets its own client IP so the shared in-process rate limiter
// (keyed by x-forwarded-for) never bleeds budget between tests. The dedicated
// rate-limit test reuses one fixed IP on purpose.
let ipCounter = 0;
const freshIp = () => `10.0.${Math.floor(ipCounter / 256) % 256}.${ipCounter++ % 256}`;
const auth = () => ({
  "x-provision-secret": PROVISION_SECRET,
  "x-forwarded-for": freshIp(),
});
const signupBody = (over: Record<string, unknown> = {}) => ({
  orgName: "Acme Inc",
  slug: `acme-${uniq()}`,
  owner: { externalId: `github:${uniq()}`, email: "ada@acme.test", name: "Ada" },
  ...over,
});

describe("cold signup", () => {
  it("provisions a tenant + owner + admin key, and the key drives the API", async () => {
    const body = signupBody();
    const res = await request(httpServer)
      .post("/v1/signup")
      .set(auth())
      .send(body)
      .expect(201);

    expect(res.body.created).toBe(true);
    expect(res.body.tenantId).toMatch(/^ten_/);
    expect(res.body.slug).toBe(body.slug);
    expect(res.body.userId).toMatch(/^usr_/);
    expect(res.body.apiKey).toMatch(/^wek_/);

    // AC: a cold visitor's new key immediately works against /v1 — it's an
    // admin key, so it reaches the admin surface (contracts list).
    await request(httpServer)
      .get("/v1/contracts")
      .set({ "x-api-key": res.body.apiKey, "x-user-id": res.body.userId })
      .expect(200);
  });
});

describe("idempotency (AC: signup is idempotent)", () => {
  it("replaying the same identity returns the same tenant and no new key", async () => {
    const externalId = `github:${uniq()}`;
    const first = await request(httpServer)
      .post("/v1/signup")
      .set(auth())
      .send(signupBody({ owner: { externalId, email: "r@replay.test" } }))
      .expect(201);
    expect(first.body.created).toBe(true);
    expect(first.body.apiKey).toMatch(/^wek_/);

    const second = await request(httpServer)
      .post("/v1/signup")
      .set(auth())
      .send(
        signupBody({
          slug: `different-${uniq()}`,
          owner: { externalId, email: "r@replay.test" },
        }),
      )
      .expect(201);
    expect(second.body.created).toBe(false);
    expect(second.body.tenantId).toBe(first.body.tenantId);
    expect(second.body.apiKey).toBeNull();
  });
});

describe("duplicate slug (AC: duplicate-slug case)", () => {
  it("rejects a slug taken by a different identity with 409", async () => {
    const slug = `taken-${uniq()}`;
    await request(httpServer)
      .post("/v1/signup")
      .set(auth())
      .send(signupBody({ slug, owner: { externalId: `github:${uniq()}` } }))
      .expect(201);

    const res = await request(httpServer)
      .post("/v1/signup")
      .set(auth())
      .send(signupBody({ slug, owner: { externalId: `github:${uniq()}` } }))
      .expect(409);
    expect(res.body.code).toBe("tenant_slug_taken");
  });
});

describe("guards", () => {
  it("rejects a missing/wrong provisioning secret with 401", async () => {
    await request(httpServer).post("/v1/signup").send(signupBody()).expect(401);
    await request(httpServer)
      .post("/v1/signup")
      .set({ "x-provision-secret": "wrong" })
      .send(signupBody())
      .expect(401);
  });

  it("rejects disposable email domains with 422", async () => {
    const res = await request(httpServer)
      .post("/v1/signup")
      .set(auth())
      .send(
        signupBody({
          owner: { externalId: `github:${uniq()}`, email: "throwaway@mailinator.com" },
        }),
      )
      .expect(422);
    expect(res.body.code).toBe("disposable_email");
  });

  it("rejects a malformed slug with 400", async () => {
    const res = await request(httpServer)
      .post("/v1/signup")
      .set(auth())
      .send(signupBody({ slug: "a b" })) // space → invalid
      .expect(400);
    // zod pipe catches length<3 as 400 too; either way it never reaches the DB.
    expect(res.status).toBe(400);
  });

  it("rate-limits repeated attempts from one client IP with 429", async () => {
    // The limiter runs as a guard BEFORE the handler, so wrong-secret 401s
    // still consume budget — 10 land, the 11th is refused without provisioning.
    const ip = { "x-forwarded-for": "203.0.113.7", "x-provision-secret": "wrong" };
    for (let i = 0; i < 10; i++) {
      await request(httpServer)
        .post("/v1/signup")
        .set(ip)
        .send(signupBody())
        .expect(401);
    }
    const res = await request(httpServer)
      .post("/v1/signup")
      .set(ip)
      .send(signupBody())
      .expect(429);
    expect(res.body.code).toBe("signup_rate_limited");
    expect(res.body.retryAfterSeconds).toBeGreaterThan(0);
  });
});
