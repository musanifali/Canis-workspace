/**
 * API-key provisioning and resolution. Both run on the OWNER connection:
 * provisioning is an admin operation, and resolution happens before a tenant
 * is known (it's how the tenant becomes known). Neither goes through
 * withTenant — everything after resolution does.
 */
import { and, eq, isNull } from "drizzle-orm";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { WorkspaceDb } from "../client.js";
import { apiKeys } from "../schema.js";
import type { TenantTx } from "../tenant.js";

/**
 * Owner-connection writer: either the pooled client or a transaction on it.
 * Key provisioning runs on the owner connection (before/outside a tenant
 * context), and callers like `provisionTenant` need it to enlist in their own
 * transaction so tenant + owner + key commit atomically.
 */
export type OwnerWriter = WorkspaceDb | TenantTx;

const hashKey = (rawKey: string): string =>
  createHash("sha256").update(rawKey).digest("hex");

/**
 * Key power domain ([review][P3]): "runtime" covers workspace CRUD and
 * telemetry ingest — the most a browser-adjacent key may hold. "admin" adds
 * the contracts registry, audit, usage, and telemetry summary.
 */
export type ApiKeyScope = "runtime" | "admin";

export interface CreatedApiKey {
  id: string;
  tenantId: string;
  name: string;
  scope: ApiKeyScope;
  /** Shown exactly once — only the sha256 hash is stored. */
  rawKey: string;
}

export interface ResolvedApiKey {
  tenantId: string;
  scope: ApiKeyScope;
}

/**
 * Provision an API key for a tenant (admin operation).
 * @returns The key metadata including the raw key, which is never stored.
 */
export async function createApiKey(
  db: OwnerWriter,
  params: { tenantId: string; name: string; scope?: ApiKeyScope },
): Promise<CreatedApiKey> {
  const rawKey = `wek_${randomBytes(24).toString("base64url")}`;
  const [row] = await db
    .insert(apiKeys)
    .values({
      id: `key_${randomUUID()}`,
      tenantId: params.tenantId,
      name: params.name,
      scope: params.scope ?? "admin",
      keyHash: hashKey(rawKey),
    })
    .returning();
  if (!row) {
    throw new Error(`Failed to create API key "${params.name}"`);
  }
  return {
    id: row.id,
    tenantId: row.tenantId,
    name: row.name,
    scope: row.scope,
    rawKey,
  };
}

/**
 * Resolve a presented API key to its tenant and scope.
 * @returns The tenant id + key scope, or null for unknown/revoked keys.
 */
export async function resolveApiKey(
  db: WorkspaceDb,
  rawKey: string,
): Promise<ResolvedApiKey | null> {
  const [row] = await db
    .select({ tenantId: apiKeys.tenantId, scope: apiKeys.scope })
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, hashKey(rawKey)), isNull(apiKeys.revokedAt)));
  return row ? { tenantId: row.tenantId, scope: row.scope } : null;
}

/**
 * Revoke an API key (admin operation). Idempotent.
 * @returns True when a live key was revoked.
 */
export async function revokeApiKey(
  db: WorkspaceDb,
  keyId: string,
): Promise<boolean> {
  const revoked = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, keyId), isNull(apiKeys.revokedAt)))
    .returning({ id: apiKeys.id });
  return revoked.length > 0;
}
