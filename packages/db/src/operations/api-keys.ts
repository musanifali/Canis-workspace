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

const hashKey = (rawKey: string): string =>
  createHash("sha256").update(rawKey).digest("hex");

export interface CreatedApiKey {
  id: string;
  tenantId: string;
  name: string;
  /** Shown exactly once — only the sha256 hash is stored. */
  rawKey: string;
}

/**
 * Provision an API key for a tenant (admin operation).
 * @returns The key metadata including the raw key, which is never stored.
 */
export async function createApiKey(
  db: WorkspaceDb,
  params: { tenantId: string; name: string },
): Promise<CreatedApiKey> {
  const rawKey = `wek_${randomBytes(24).toString("base64url")}`;
  const [row] = await db
    .insert(apiKeys)
    .values({
      id: `key_${randomUUID()}`,
      tenantId: params.tenantId,
      name: params.name,
      keyHash: hashKey(rawKey),
    })
    .returning();
  if (!row) {
    throw new Error(`Failed to create API key "${params.name}"`);
  }
  return { id: row.id, tenantId: row.tenantId, name: row.name, rawKey };
}

/**
 * Resolve a presented API key to its tenant.
 * @returns The tenant id, or null for unknown/revoked keys.
 */
export async function resolveApiKey(
  db: WorkspaceDb,
  rawKey: string,
): Promise<string | null> {
  const [row] = await db
    .select({ tenantId: apiKeys.tenantId })
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, hashKey(rawKey)), isNull(apiKeys.revokedAt)));
  return row?.tenantId ?? null;
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
