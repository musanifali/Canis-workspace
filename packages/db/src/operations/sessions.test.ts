import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { WorkspaceDbClient } from "../client.js";
import { connectTestDb } from "../test-helpers.js";
import { provisionTenant } from "./signup.js";
import {
  createSession,
  deleteSession,
  deleteUserSessions,
  getUserByExternalId,
  listTenantMembers,
  resolveSession,
} from "./sessions.js";

let client: WorkspaceDbClient;
const uniq = () => Math.random().toString(36).slice(2, 10);

// A provisioned tenant + owner user to hang sessions off.
async function freshOwner() {
  const p = await provisionTenant(client.db, {
    orgName: "Sess Co",
    slug: `sess-${uniq()}`,
    owner: { externalId: `github:${uniq()}`, email: "o@sess.test", name: "Owner" },
  });
  return { userId: p.owner.id, tenantId: p.tenant.id, externalId: p.owner.externalId };
}

beforeAll(async () => {
  client = await connectTestDb();
});
afterAll(async () => {
  await client?.close();
});

describe("createSession / resolveSession", () => {
  it("mints a token that resolves to the user, and stores only its hash", async () => {
    const { userId, tenantId } = await freshOwner();
    const { token, expiresAt } = await createSession(client.db, { userId, tenantId });

    expect(token).toMatch(/[A-Za-z0-9_-]{20,}/);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    const resolved = await resolveSession(client.db, token);
    expect(resolved).toMatchObject({ userId, tenantId, role: "owner", name: "Owner" });
  });

  it("mints a fresh token each login (no fixation) and an unknown token resolves to null", async () => {
    const { userId, tenantId } = await freshOwner();
    const a = await createSession(client.db, { userId, tenantId });
    const b = await createSession(client.db, { userId, tenantId });
    expect(a.token).not.toBe(b.token);
    expect(await resolveSession(client.db, "not-a-real-token")).toBeNull();
  });

  it("does not resolve an expired session", async () => {
    const { userId, tenantId } = await freshOwner();
    const { token } = await createSession(client.db, {
      userId,
      tenantId,
      ttlMs: -1000, // already expired
    });
    expect(await resolveSession(client.db, token)).toBeNull();
  });
});

describe("deleteSession (logout = server-side revocation)", () => {
  it("resolves before logout, and null after — the same token is dead", async () => {
    const { userId, tenantId } = await freshOwner();
    const { token } = await createSession(client.db, { userId, tenantId });
    expect(await resolveSession(client.db, token)).not.toBeNull();

    expect(await deleteSession(client.db, token)).toBe(true);
    expect(await resolveSession(client.db, token)).toBeNull();
    // Idempotent: deleting again is a no-op, not an error.
    expect(await deleteSession(client.db, token)).toBe(false);
  });

  it("deleteUserSessions revokes every session for a user (offboarding)", async () => {
    const { userId, tenantId } = await freshOwner();
    const s1 = await createSession(client.db, { userId, tenantId });
    const s2 = await createSession(client.db, { userId, tenantId });
    const removed = await deleteUserSessions(client.db, userId);
    expect(removed).toBe(2);
    expect(await resolveSession(client.db, s1.token)).toBeNull();
    expect(await resolveSession(client.db, s2.token)).toBeNull();
  });
});

describe("user resolution + member list", () => {
  it("getUserByExternalId finds the signed-up user, null for a stranger", async () => {
    const { userId, externalId } = await freshOwner();
    const found = await getUserByExternalId(client.db, externalId);
    expect(found?.id).toBe(userId);
    expect(await getUserByExternalId(client.db, `github:nobody-${uniq()}`)).toBeNull();
  });

  it("listTenantMembers returns the tenant's users", async () => {
    const { tenantId, userId } = await freshOwner();
    const members = await listTenantMembers(client.db, tenantId);
    expect(members.map((m) => m.id)).toContain(userId);
    expect(members.every((m) => m.tenantId === tenantId)).toBe(true);
  });
});
