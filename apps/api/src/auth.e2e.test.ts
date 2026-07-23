/**
 * Dashboard session auth (#93). Exercises the /v1/auth surface end-to-end:
 * login (provision-secret gated) → session token; session resolution; logout
 * as real server-side revocation; and the owner-only member list. These are
 * the API-side guarantees behind the card's ACs (real user ids, revocable
 * sessions, no fixation).
 */
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { createDbClient, provisionTenant, users } from "@workspace-engine/db";
import request from "supertest";
import type { App } from "supertest/types";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "./app.module.js";

const TEST_DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5443/workspace_engine_test";
const PROVISION_SECRET = "auth-test-secret";
const uniq = () => Math.random().toString(36).slice(2, 9);

let app: INestApplication;
let httpServer: App;
let admin: ReturnType<typeof createDbClient>;

// An owner (from signup) and a second member in the SAME tenant.
let owner: { externalId: string; userId: string; tenantId: string };
let member: { externalId: string; userId: string };

beforeAll(async () => {
  process.env.WORKSPACE_PROVISION_SECRET = PROVISION_SECRET;
  admin = createDbClient(TEST_DATABASE_URL);
  await admin.pool.query("select 1");

  const prov = await provisionTenant(admin.db, {
    orgName: "Auth Co",
    slug: `auth-${uniq()}`,
    owner: { externalId: `github:${uniq()}`, email: "owner@auth.test", name: "Owner" },
  });
  owner = { externalId: prov.owner.externalId, userId: prov.owner.id, tenantId: prov.tenant.id };
  // Add a second user (a "member") directly into the same tenant.
  const memberExternal = `github:${uniq()}`;
  const [m] = await admin.db
    .insert(users)
    .values({
      id: `usr_${uniq()}${uniq()}`,
      tenantId: prov.tenant.id,
      externalId: memberExternal,
      email: "member@auth.test",
      name: "Member",
      role: "member",
    })
    .returning();
  member = { externalId: memberExternal, userId: m!.id };

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

const secret = { "x-provision-secret": PROVISION_SECRET };

describe("login", () => {
  it("mints a session for a known identity and returns the real user", async () => {
    const res = await request(httpServer)
      .post("/v1/auth/login")
      .set(secret)
      .send({ externalId: owner.externalId })
      .expect(200);
    expect(res.body.token).toMatch(/[A-Za-z0-9_-]{20,}/);
    expect(res.body.user).toMatchObject({
      userId: owner.userId,
      tenantId: owner.tenantId,
      role: "owner",
    });
  });

  it("requires the provisioning secret", async () => {
    await request(httpServer)
      .post("/v1/auth/login")
      .send({ externalId: owner.externalId })
      .expect(401);
  });

  it("404s for an identity that never signed up", async () => {
    const res = await request(httpServer)
      .post("/v1/auth/login")
      .set(secret)
      .send({ externalId: `github:stranger-${uniq()}` })
      .expect(404);
    expect(res.body.code).toBe("user_not_found");
  });

  it("mints a distinct token each login (no fixation)", async () => {
    const a = await request(httpServer).post("/v1/auth/login").set(secret).send({ externalId: owner.externalId });
    const b = await request(httpServer).post("/v1/auth/login").set(secret).send({ externalId: owner.externalId });
    expect(a.body.token).not.toBe(b.body.token);
  });
});

describe("session resolution + logout (server-side revocation)", () => {
  it("resolves a valid session, and stops resolving after logout", async () => {
    const login = await request(httpServer).post("/v1/auth/login").set(secret).send({ externalId: owner.externalId });
    const auth = { authorization: `Bearer ${login.body.token}` };

    await request(httpServer).get("/v1/auth/session").set(auth).expect(200);
    await request(httpServer).post("/v1/auth/logout").set(auth).expect(204);
    // The same token is dead server-side now.
    await request(httpServer).get("/v1/auth/session").set(auth).expect(401);
  });

  it("rejects a missing or garbage token", async () => {
    await request(httpServer).get("/v1/auth/session").expect(401);
    await request(httpServer)
      .get("/v1/auth/session")
      .set({ authorization: "Bearer not-a-real-token" })
      .expect(401);
  });
});

describe("member list", () => {
  it("owner sees both users in the tenant", async () => {
    const login = await request(httpServer).post("/v1/auth/login").set(secret).send({ externalId: owner.externalId });
    const res = await request(httpServer)
      .get("/v1/auth/members")
      .set({ authorization: `Bearer ${login.body.token}` })
      .expect(200);
    const ids = res.body.map((m: { id: string }) => m.id);
    expect(ids).toContain(owner.userId);
    expect(ids).toContain(member.userId);
  });

  it("a member (non-owner) is refused with owner_only", async () => {
    const login = await request(httpServer).post("/v1/auth/login").set(secret).send({ externalId: member.externalId });
    const res = await request(httpServer)
      .get("/v1/auth/members")
      .set({ authorization: `Bearer ${login.body.token}` })
      .expect(403);
    expect(res.body.code).toBe("owner_only");
  });
});
