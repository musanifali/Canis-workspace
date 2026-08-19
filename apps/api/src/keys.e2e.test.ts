/**
 * API-key management (#92). Covers the card's ACs against a running /v1:
 * mint→use→revoke→use-again(401) as one flow; runtime keys are refused on the
 * whole surface (403); the raw key is returned exactly once; last_used_at
 * appears and updates; a revoked key fails auth immediately.
 */
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { createApiKey, createDbClient, provisionTenant } from "@workspace-engine/db";
import request from "supertest";
import type { App } from "supertest/types";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "./app.module.js";

const TEST_DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5443/workspace_engine_test";
const uniq = () => Math.random().toString(36).slice(2, 9);

let app: INestApplication;
let httpServer: App;
let admin: ReturnType<typeof createDbClient>;
let adminKey: Record<string, string>;
let runtimeKey: Record<string, string>;

beforeAll(async () => {
  admin = createDbClient(TEST_DATABASE_URL);
  await admin.pool.query("select 1");
  const prov = await provisionTenant(admin.db, {
    orgName: "Keys API",
    slug: `keysapi-${uniq()}`,
    owner: { externalId: `github:${uniq()}` },
  });
  const runtime = await createApiKey(admin.db, {
    tenantId: prov.tenant.id,
    name: "runtime",
    scope: "runtime",
  });
  adminKey = { "x-api-key": prov.apiKey!.rawKey, "x-user-id": prov.owner.id };
  runtimeKey = { "x-api-key": runtime.rawKey, "x-user-id": "u_rt" };

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

describe("mint → use → revoke → use-again(401) as one flow", () => {
  it("runs the full lifecycle", async () => {
    // Mint a new runtime key with the admin key.
    const minted = await request(httpServer)
      .post("/v1/keys")
      .set(adminKey)
      .send({ name: "ci-runner", scope: "runtime" })
      .expect(201);
    expect(minted.body.rawKey).toMatch(/^wek_/);
    expect(minted.body.scope).toBe("runtime");
    const rawKey = minted.body.rawKey as string;
    const keyId = minted.body.id as string;

    // The new key works against /v1 (a runtime-allowed path).
    await request(httpServer)
      .get("/v1/workspaces")
      .set({ "x-api-key": rawKey, "x-user-id": "u1" })
      .expect(200);

    // Revoke it with the admin key.
    await request(httpServer).delete(`/v1/keys/${keyId}`).set(adminKey).expect(204);

    // Immediately fails auth everywhere (no cache staleness).
    await request(httpServer)
      .get("/v1/workspaces")
      .set({ "x-api-key": rawKey, "x-user-id": "u1" })
      .expect(401);

    // Revoke is idempotent → 404 on a now-dead key.
    await request(httpServer).delete(`/v1/keys/${keyId}`).set(adminKey).expect(404);
  });
});

describe("raw key shown exactly once", () => {
  it("mint returns rawKey, but list never does", async () => {
    const minted = await request(httpServer)
      .post("/v1/keys")
      .set(adminKey)
      .send({ name: "once", scope: "admin" })
      .expect(201);
    const list = await request(httpServer).get("/v1/keys").set(adminKey).expect(200);
    const listed = list.body.find((k: { id: string }) => k.id === minted.body.id);
    expect(listed).toBeDefined();
    expect(listed).not.toHaveProperty("rawKey");
    expect(JSON.stringify(list.body)).not.toContain(minted.body.rawKey);
  });
});

describe("last_used_at", () => {
  it("is null until used, then populated after a request", async () => {
    const minted = await request(httpServer)
      .post("/v1/keys")
      .set(adminKey)
      .send({ name: "tracked", scope: "runtime" })
      .expect(201);
    expect(minted.body.lastUsedAt).toBeNull();

    await request(httpServer)
      .get("/v1/workspaces")
      .set({ "x-api-key": minted.body.rawKey, "x-user-id": "u2" })
      .expect(200);

    const list = await request(httpServer).get("/v1/keys").set(adminKey).expect(200);
    const listed = list.body.find((k: { id: string }) => k.id === minted.body.id);
    expect(listed.lastUsedAt).not.toBeNull();
  });
});

describe("runtime keys are refused on the whole /v1/keys surface", () => {
  it("403 insufficient_key_scope on list, mint, and revoke", async () => {
    const list = await request(httpServer).get("/v1/keys").set(runtimeKey).expect(403);
    expect(list.body.code).toBe("insufficient_key_scope");
    await request(httpServer)
      .post("/v1/keys")
      .set(runtimeKey)
      .send({ name: "x", scope: "runtime" })
      .expect(403);
    await request(httpServer).delete("/v1/keys/whatever").set(runtimeKey).expect(403);
  });
});
