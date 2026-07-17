/**
 * /v1 contract tests (#26 — run in CI against the postgres service). The app
 * boots against the test database; requests go through the real guard,
 * pipes, controller, service, operations layer, and RLS.
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
import { readFileSync } from "node:fs";
import { join } from "node:path";
import request from "supertest";
import type { App } from "supertest/types.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "./app.module.js";
import { buildOpenApiDocument } from "./openapi.js";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5443/workspace_engine_test";

let app: INestApplication;
let httpServer: App;
let admin: WorkspaceDbClient;
let apiKeyA: string;
let apiKeyB: string;

const specBody = (title: string) => ({
  spec: {
    specVersion: 1,
    title,
    timezone: "viewer",
    refresh: { mode: "manual" },
    layout: { columns: 12 },
    blocks: [
      {
        id: "blk_a1",
        type: "NoteCard",
        frame: { x: 0, y: 0, w: 6, h: 4 },
        config: { text: "hello" },
        binding: null,
      },
    ],
  },
});

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
    { id: tenantA, name: "API Tenant A" },
    { id: tenantB, name: "API Tenant B" },
  ]);
  apiKeyA = (await createApiKey(admin.db, { tenantId: tenantA, name: "a" })).rawKey;
  apiKeyB = (await createApiKey(admin.db, { tenantId: tenantB, name: "b" })).rawKey;
  asA["x-api-key"] = apiKeyA;
  asB["x-api-key"] = apiKeyB;

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

describe("auth", () => {
  it("401s without an API key", async () => {
    await request(httpServer).get("/v1/workspaces").expect(401);
  });

  it("401s with an unknown API key", async () => {
    await request(httpServer)
      .get("/v1/workspaces")
      .set({ "x-api-key": "wek_bogus", "x-user-id": "u" })
      .expect(401);
  });

  it("401s without an acting user", async () => {
    await request(httpServer)
      .get("/v1/workspaces")
      .set({ "x-api-key": apiKeyA })
      .expect(401);
  });
});

describe("workspace lifecycle over HTTP", () => {
  it("create → get → list → update → versions → rollback → delete", async () => {
    const created = await request(httpServer)
      .post("/v1/workspaces")
      .set(asA)
      .send({ ...specBody("HTTP board"), prompt: "make a board" })
      .expect(201);
    const id = created.body.id as string;
    expect(created.body.title).toBe("HTTP board");
    expect(created.body.headVersion).toBe(1);
    expect(created.body.ownerUserId).toBe("user_alice");

    const fetched = await request(httpServer)
      .get(`/v1/workspaces/${id}`)
      .set(asA)
      .expect(200);
    expect(fetched.body.spec.title).toBe("HTTP board");
    expect(typeof fetched.body.updatedAt).toBe("number");

    const listed = await request(httpServer)
      .get("/v1/workspaces")
      .set(asA)
      .expect(200);
    expect(listed.body.map((w: { id: string }) => w.id)).toContain(id);
    expect(listed.body[0].spec).toBeUndefined();

    const updated = await request(httpServer)
      .put(`/v1/workspaces/${id}`)
      .set(asA)
      .send({ ...specBody("HTTP board v2"), prompt: "rename it" })
      .expect(200);
    expect(updated.body.headVersion).toBe(2);
    expect(updated.body.title).toBe("HTTP board v2");

    const versions = await request(httpServer)
      .get(`/v1/workspaces/${id}/versions`)
      .set(asA)
      .expect(200);
    expect(
      versions.body.map((v: { versionNumber: number }) => v.versionNumber),
    ).toEqual([2, 1]);
    expect(versions.body[1].prompt).toBe("make a board");

    const rolled = await request(httpServer)
      .post(`/v1/workspaces/${id}/rollback`)
      .set(asA)
      .send({ toVersion: 1 })
      .expect(200);
    expect(rolled.body.headVersion).toBe(1);
    expect(rolled.body.title).toBe("HTTP board");

    await request(httpServer).delete(`/v1/workspaces/${id}`).set(asA).expect(204);
    await request(httpServer).get(`/v1/workspaces/${id}`).set(asA).expect(404);
  });

  it("rejects an invalid spec with 400 and named issues", async () => {
    const response = await request(httpServer)
      .post("/v1/workspaces")
      .set(asA)
      .send({ spec: { specVersion: 1, title: "no blocks" } })
      .expect(400);
    expect(JSON.stringify(response.body.issues)).toContain("blocks");
  });

  it("404s for an unknown workspace and an unknown rollback target", async () => {
    await request(httpServer).get("/v1/workspaces/ws_nope").set(asA).expect(404);
    const created = await request(httpServer)
      .post("/v1/workspaces")
      .set(asA)
      .send(specBody("Rollback probe"))
      .expect(201);
    await request(httpServer)
      .post(`/v1/workspaces/${created.body.id}/rollback`)
      .set(asA)
      .send({ toVersion: 42 })
      .expect(404);
  });
});

describe("tenant isolation over HTTP", () => {
  it("tenant B's key cannot see or touch tenant A's workspace", async () => {
    const created = await request(httpServer)
      .post("/v1/workspaces")
      .set(asA)
      .send(specBody("A-only"))
      .expect(201);
    const id = created.body.id as string;

    await request(httpServer).get(`/v1/workspaces/${id}`).set(asB).expect(404);
    await request(httpServer)
      .put(`/v1/workspaces/${id}`)
      .set(asB)
      .send(specBody("hijack"))
      .expect(404);
    await request(httpServer).delete(`/v1/workspaces/${id}`).set(asB).expect(404);

    const listedB = await request(httpServer)
      .get("/v1/workspaces")
      .set(asB)
      .expect(200);
    expect(listedB.body.map((w: { id: string }) => w.id)).not.toContain(id);
  });
});

describe("OpenAPI contract artifact", () => {
  it("the committed openapi.json matches the controllers", () => {
    const committed = JSON.parse(
      readFileSync(join(__dirname, "..", "openapi.json"), "utf8"),
    );
    const live = buildOpenApiDocument(app);
    expect(Object.keys(live.paths).toSorted()).toEqual(
      Object.keys(committed.paths).toSorted(),
    );
    expect(live.components?.schemas).toEqual(committed.components?.schemas);
  });
});
