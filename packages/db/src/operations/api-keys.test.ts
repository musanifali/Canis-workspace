/**
 * API-key management (#92): listing, throttled last_used_at, and tenant-scoped
 * revocation. Resolution/scope behaviour is covered by the API's
 * key-scopes.e2e; this pins the DB-layer contract the key UI depends on.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { WorkspaceDbClient } from "../client.js";
import { apiKeys } from "../schema.js";
import { connectTestDb } from "../test-helpers.js";
import { provisionTenant } from "./signup.js";
import {
  createApiKey,
  listApiKeys,
  resolveApiKey,
  revokeApiKey,
} from "./api-keys.js";

let client: WorkspaceDbClient;
const uniq = () => Math.random().toString(36).slice(2, 10);

async function freshTenant() {
  const p = await provisionTenant(client.db, {
    orgName: "Keys Co",
    slug: `keys-${uniq()}`,
    owner: { externalId: `github:${uniq()}` },
  });
  return p.tenant.id;
}

beforeAll(async () => {
  client = await connectTestDb();
});
afterAll(async () => {
  await client?.close();
});

describe("listApiKeys", () => {
  it("returns metadata newest-first, never the hash, including revoked keys", async () => {
    const tenantId = await freshTenant(); // provisioning already made a 'default' admin key
    const runtime = await createApiKey(client.db, { tenantId, name: "ci", scope: "runtime" });
    await revokeApiKey(client.db, { keyId: runtime.id, tenantId });

    const keys = await listApiKeys(client.db, tenantId);
    expect(keys.length).toBeGreaterThanOrEqual(2);
    // No hash/raw-key field leaks through the metadata shape.
    expect(Object.keys(keys[0]!)).toEqual(
      expect.arrayContaining(["id", "name", "scope", "createdAt", "lastUsedAt", "revokedAt"]),
    );
    expect(keys[0]!).not.toHaveProperty("keyHash");
    const revoked = keys.find((k) => k.id === runtime.id);
    expect(revoked?.revokedAt).not.toBeNull();
  });
});

describe("resolveApiKey — throttled last_used_at", () => {
  it("stamps last_used_at on first use and doesn't rewrite within the window", async () => {
    const tenantId = await freshTenant();
    const key = await createApiKey(client.db, { tenantId, name: "used", scope: "admin" });

    const readLastUsed = async () => {
      const [row] = await client.db
        .select({ lastUsedAt: apiKeys.lastUsedAt })
        .from(apiKeys)
        .where(eq(apiKeys.id, key.id));
      return row!.lastUsedAt;
    };

    expect(await readLastUsed()).toBeNull();
    await resolveApiKey(client.db, key.rawKey);
    const first = await readLastUsed();
    expect(first).not.toBeNull();

    // A second resolve inside the throttle window must NOT move the timestamp
    // (no write amplification on the hot path).
    await resolveApiKey(client.db, key.rawKey);
    expect((await readLastUsed())!.getTime()).toBe(first!.getTime());
  });

  it("does not resolve or stamp a revoked key", async () => {
    const tenantId = await freshTenant();
    const key = await createApiKey(client.db, { tenantId, name: "gone", scope: "admin" });
    await revokeApiKey(client.db, { keyId: key.id, tenantId });
    expect(await resolveApiKey(client.db, key.rawKey)).toBeNull();
  });
});

describe("revokeApiKey — tenant-scoped", () => {
  it("cannot revoke another tenant's key by id", async () => {
    const tenantA = await freshTenant();
    const tenantB = await freshTenant();
    const keyA = await createApiKey(client.db, { tenantId: tenantA, name: "a", scope: "admin" });

    // Tenant B tries to revoke tenant A's key — no match, no revocation.
    expect(await revokeApiKey(client.db, { keyId: keyA.id, tenantId: tenantB })).toBe(false);
    expect(await resolveApiKey(client.db, keyA.rawKey)).not.toBeNull(); // still live

    // Its true tenant can.
    expect(await revokeApiKey(client.db, { keyId: keyA.id, tenantId: tenantA })).toBe(true);
    expect(await resolveApiKey(client.db, keyA.rawKey)).toBeNull();
  });
});
