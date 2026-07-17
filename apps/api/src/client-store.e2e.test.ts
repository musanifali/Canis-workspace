/**
 * The port swap, exercised end-to-end: the typed client's HTTP-backed
 * WorkspaceStore driving a real listening server — the same five calls the
 * SDK makes against localStorage today.
 */
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  createHttpWorkspaceStore,
  createWorkspaceServiceClient,
  WorkspaceNotFoundError,
} from "@workspace-engine/client";
import {
  createApiKey,
  createDbClient,
  tenants,
  type WorkspaceDbClient,
} from "@workspace-engine/db";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "./app.module.js";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5443/workspace_engine_test";

let app: INestApplication;
let admin: WorkspaceDbClient;
let baseUrl: string;
let apiKey: string;

const spec = (title: string) => ({
  specVersion: 1 as const,
  title,
  timezone: "viewer",
  refresh: { mode: "manual" as const },
  layout: { columns: 12 as const },
  blocks: [
    {
      id: "blk_a1",
      type: "NoteCard",
      frame: { x: 0, y: 0, w: 6, h: 4 },
      config: {},
      binding: null,
    },
  ],
});

beforeAll(async () => {
  admin = createDbClient(TEST_DATABASE_URL);
  const tenantId = `ten_${randomUUID()}`;
  await admin.db.insert(tenants).values({ id: tenantId, name: "Client Tenant" });
  apiKey = (await createApiKey(admin.db, { tenantId, name: "client" })).rawKey;

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.forDatabase(TEST_DATABASE_URL)],
  }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix("v1");
  await app.listen(0);
  baseUrl = await app.getUrl();
});

afterAll(async () => {
  await app?.close();
  await admin?.close();
});

describe("HTTP WorkspaceStore against a live server", () => {
  it("round-trips the full port surface", async () => {
    const store = createHttpWorkspaceStore({
      baseUrl,
      apiKey,
      userId: "user_carol",
    });

    const created = await store.create(spec("Port swap"));
    expect(created.title).toBe("Port swap");
    expect(created.spec.blocks).toHaveLength(1);
    expect(typeof created.updatedAt).toBe("number");

    const fetched = await store.get(created.id);
    expect(fetched.spec).toEqual(created.spec);

    const updated = await store.update(created.id, spec("Port swap v2"));
    expect(updated.title).toBe("Port swap v2");

    const summaries = await store.list();
    const summary = summaries.find((s) => s.id === created.id);
    expect(summary?.title).toBe("Port swap v2");
    expect(summary && "spec" in summary && summary.spec).toBeFalsy();

    await store.remove(created.id);
    await expect(store.get(created.id)).rejects.toThrow(WorkspaceNotFoundError);
  });

  it("exposes versions + rollback beyond the minimal port", async () => {
    const client = createWorkspaceServiceClient({
      baseUrl,
      apiKey,
      userId: "user_carol",
    });
    const created = await client.createWorkspace({
      spec: spec("Versioned"),
      prompt: "v1 prompt",
    });
    await client.updateWorkspace(created.id, {
      spec: spec("Versioned v2"),
      prompt: "v2 prompt",
    });

    const versions = await client.listVersions(created.id);
    expect(versions.map((v) => v.versionNumber)).toEqual([2, 1]);
    expect(versions[1]?.prompt).toBe("v1 prompt");

    const rolled = await client.rollbackWorkspace(created.id, 1);
    expect(rolled.title).toBe("Versioned");
  });
});
