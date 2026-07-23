import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { WorkspaceDbClient } from "../client.js";
import { apiKeys, auditLog, tenants, users } from "../schema.js";
import { withTenant } from "../tenant.js";
import { connectTestDb } from "../test-helpers.js";
import { resolveApiKey } from "./api-keys.js";
import {
  InvalidSlugError,
  provisionTenant,
  slugify,
  TenantSlugTakenError,
} from "./signup.js";

let client: WorkspaceDbClient;

// Unique per run so repeated local runs don't collide on the global
// external_id / slug uniqueness.
const uniq = () => Math.random().toString(36).slice(2, 10);

beforeAll(async () => {
  client = await connectTestDb();
});

afterAll(async () => {
  await client?.close();
});

describe("provisionTenant", () => {
  it("creates tenant + owner user + admin key + audit in one shot", async () => {
    const slug = `acme-${uniq()}`;
    const result = await provisionTenant(client.db, {
      orgName: "Acme Inc",
      slug,
      owner: { externalId: `github:${uniq()}`, email: "a@acme.test", name: "Ada" },
    });

    expect(result.created).toBe(true);
    expect(result.tenant.slug).toBe(slug);
    expect(result.tenant.name).toBe("Acme Inc");
    expect(result.owner.role).toBe("owner");
    expect(result.owner.tenantId).toBe(result.tenant.id);
    expect(result.apiKey?.scope).toBe("admin");
    expect(result.apiKey?.rawKey).toMatch(/^wek_/);

    // The minted key actually resolves to this tenant with admin scope.
    const resolved = await resolveApiKey(client.db, result.apiKey!.rawKey);
    expect(resolved).toEqual({ tenantId: result.tenant.id, scope: "admin" });

    // Owner user + admin key + a tenant.provisioned audit row all landed.
    const owners = await client.db
      .select()
      .from(users)
      .where(eq(users.tenantId, result.tenant.id));
    expect(owners).toHaveLength(1);

    const keys = await client.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.tenantId, result.tenant.id));
    expect(keys).toHaveLength(1);

    const trail = await withTenant(
      client.db,
      { tenantId: result.tenant.id, userId: result.owner.id },
      (tx) =>
        tx.select().from(auditLog).where(eq(auditLog.tenantId, result.tenant.id)),
    );
    expect(trail).toHaveLength(1);
    expect(trail[0]?.action).toBe("tenant.provisioned");
    expect(trail[0]?.actorUserId).toBe(result.owner.id);
  });

  it("is idempotent on the owner's external id (replay returns the same tenant, no new key)", async () => {
    const externalId = `github:${uniq()}`;
    const first = await provisionTenant(client.db, {
      orgName: "Replay Co",
      slug: `replay-${uniq()}`,
      owner: { externalId, email: "r@replay.test" },
    });
    // A second call — e.g. the OAuth callback fired twice, or the user hit
    // signup again — with a DIFFERENT desired slug still returns the original.
    const second = await provisionTenant(client.db, {
      orgName: "Replay Co Again",
      slug: `replay-different-${uniq()}`,
      owner: { externalId, email: "r@replay.test" },
    });

    expect(second.created).toBe(false);
    expect(second.tenant.id).toBe(first.tenant.id);
    expect(second.tenant.slug).toBe(first.tenant.slug); // unchanged
    expect(second.apiKey).toBeNull(); // key handed over once, never again

    // Exactly one tenant, one user, one key — no duplication.
    const tenantRows = await client.db
      .select()
      .from(tenants)
      .where(eq(tenants.id, first.tenant.id));
    expect(tenantRows).toHaveLength(1);
    const keyRows = await client.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.tenantId, first.tenant.id));
    expect(keyRows).toHaveLength(1);
  });

  it("rejects a slug already taken by a different tenant", async () => {
    const slug = `dup-${uniq()}`;
    await provisionTenant(client.db, {
      orgName: "First",
      slug,
      owner: { externalId: `github:${uniq()}` },
    });

    await expect(
      provisionTenant(client.db, {
        orgName: "Second",
        slug, // same slug, different owner identity
        owner: { externalId: `github:${uniq()}` },
      }),
    ).rejects.toBeInstanceOf(TenantSlugTakenError);

    // The failed attempt left nothing behind (transaction rolled back).
    const rows = await client.db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, slug));
    expect(rows).toHaveLength(1);
  });

  it("rejects malformed slugs before touching the database", async () => {
    for (const bad of ["ab", "has space", "-lead", "trail-", "a--b", "x".repeat(41)]) {
      await expect(
        provisionTenant(client.db, {
          orgName: "Bad",
          slug: bad,
          owner: { externalId: `github:${uniq()}` },
        }),
      ).rejects.toBeInstanceOf(InvalidSlugError);
    }
  });

  it("normalizes case and surrounding whitespace on an otherwise-valid slug", async () => {
    const result = await provisionTenant(client.db, {
      orgName: "Mixed Case",
      slug: `  Mixed-${uniq()}  `,
      owner: { externalId: `github:${uniq()}` },
    });
    expect(result.tenant.slug).toBe(result.tenant.slug.toLowerCase());
    expect(result.tenant.slug.startsWith("mixed-")).toBe(true);
  });
});

describe("slugify", () => {
  it("produces url-safe candidates", () => {
    expect(slugify("Acme Inc.")).toBe("acme-inc");
    expect(slugify("  Hello, World!  ")).toBe("hello-world");
    expect(slugify("Foo___Bar")).toBe("foo-bar");
  });
});
