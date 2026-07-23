/**
 * Tenant self-provisioning (#91). Runs on the OWNER connection, like tenant
 * and api-key creation — signup happens before any tenant context exists, so
 * it cannot go through withTenant/RLS. One transaction creates the tenant, its
 * owner user, and the first admin API key, so a half-provisioned tenant can
 * never exist.
 */
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { WorkspaceDb } from "../client.js";
import {
  auditLog,
  tenants,
  users,
  type DBTenant,
  type DBUser,
} from "../schema.js";
import { createApiKey, type CreatedApiKey } from "./api-keys.js";

/**
 * Org slug rule: 3–40 chars, lowercase alphanumeric with internal single
 * hyphens (no leading/trailing/doubled hyphens). It's a public URL segment,
 * so keep it boring.
 */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MIN = 3;
const SLUG_MAX = 40;

/** Slug failed the format rule — the API maps this to a 422, not a 409. */
export class InvalidSlugError extends Error {
  readonly code = "invalid_slug";
  constructor(slug: string) {
    super(
      `"${slug}" is not a valid org slug: use ${SLUG_MIN}-${SLUG_MAX} ` +
        `lowercase letters, numbers, and single hyphens`,
    );
    this.name = "InvalidSlugError";
  }
}

/** Slug already belongs to a different tenant — the API maps this to a 409. */
export class TenantSlugTakenError extends Error {
  readonly code = "tenant_slug_taken";
  constructor(slug: string) {
    super(`the org slug "${slug}" is already taken`);
    this.name = "TenantSlugTakenError";
  }
}

export interface ProvisionTenantParams {
  /** Human-facing org name (display only). */
  orgName: string;
  /** URL-safe handle, unique across all tenants. Validated here. */
  slug: string;
  /** The signer-upper, from the auth provider. */
  owner: {
    /** `"<provider>:<id>"`, e.g. `"github:12345"`. */
    externalId: string;
    email?: string | null;
    name?: string | null;
  };
}

export interface ProvisionedTenant {
  tenant: DBTenant;
  owner: DBUser;
  /**
   * The admin key's raw value — shown exactly once. Non-null only on first
   * provision (`created === true`); an idempotent replay returns null because
   * the key was already handed over and only its hash is stored.
   */
  apiKey: CreatedApiKey | null;
  /** false = idempotent replay of an identity that already signed up. */
  created: boolean;
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  // pg errors surface as { code: "23505", constraint: "..." }, wrapped by
  // drizzle as the `cause` of a "Failed query" Error.
  for (let e: unknown = error; e instanceof Error; e = e.cause) {
    const pg = e as { code?: string; constraint?: string };
    if (pg.code === "23505" && pg.constraint === constraint) return true;
  }
  return false;
}

/**
 * Provision a brand-new tenant for a signing-up user, or return the existing
 * tenant if this identity already signed up (idempotent on `owner.externalId`).
 *
 * Idempotency is what makes the signup endpoint safe to retry and safe against
 * an OAuth callback that fires twice: the second call finds the user by their
 * external id and returns their tenant with `created: false` — no duplicate
 * tenant, no second key.
 *
 * @throws InvalidSlugError when the slug is malformed.
 * @throws TenantSlugTakenError when the slug is taken by another tenant.
 * @returns The tenant, owner user, and (first time only) the raw admin key.
 */
export async function provisionTenant(
  db: WorkspaceDb,
  params: ProvisionTenantParams,
): Promise<ProvisionedTenant> {
  // Idempotent replay: this identity already has a tenant.
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.externalId, params.owner.externalId));
  if (existing) {
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, existing.tenantId));
    if (!tenant) {
      // Users always reference a live tenant (FK); a missing one is a bug.
      throw new Error(
        `user ${existing.id} references missing tenant ${existing.tenantId}`,
      );
    }
    return { tenant, owner: existing, apiKey: null, created: false };
  }

  const slug = params.slug.trim().toLowerCase();
  if (
    slug.length < SLUG_MIN ||
    slug.length > SLUG_MAX ||
    !SLUG_PATTERN.test(slug)
  ) {
    throw new InvalidSlugError(params.slug);
  }

  try {
    return await db.transaction(async (tx) => {
      const [tenant] = await tx
        .insert(tenants)
        .values({
          id: `ten_${randomUUID()}`,
          name: params.orgName,
          slug,
        })
        .returning();
      if (!tenant) throw new Error("tenant insert returned no row");

      const [owner] = await tx
        .insert(users)
        .values({
          id: `usr_${randomUUID()}`,
          tenantId: tenant.id,
          externalId: params.owner.externalId,
          email: params.owner.email ?? null,
          name: params.owner.name ?? null,
          role: "owner",
        })
        .returning();
      if (!owner) throw new Error("owner insert returned no row");

      const apiKey = await createApiKey(tx, {
        tenantId: tenant.id,
        name: "default",
        scope: "admin",
      });

      // First audit entry of the tenant's life: the owner provisioned it.
      // Owner connection bypasses RLS, so this direct insert is fine.
      await tx.insert(auditLog).values({
        tenantId: tenant.id,
        actorUserId: owner.id,
        action: "tenant.provisioned",
        detail: { slug: tenant.slug, via: "self-signup" },
      });

      return { tenant, owner, apiKey, created: true };
    });
  } catch (error) {
    // Lost a slug race between the availability check and the insert.
    if (isUniqueViolation(error, "tenants_slug_unique")) {
      throw new TenantSlugTakenError(slug);
    }
    throw error;
  }
}

/**
 * Derive a candidate slug from an org name: lowercase, non-alphanumerics to
 * hyphens, collapse/trim hyphens, clamp length. May collide or (for very short
 * names) fall below the minimum — callers must handle rejection, this is just
 * a friendly default for the signup form.
 * @returns A best-effort slug candidate (possibly invalid; not guaranteed free).
 */
export function slugify(orgName: string): string {
  return orgName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}
