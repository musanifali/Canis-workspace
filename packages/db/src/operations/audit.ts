import { and, desc, eq } from "drizzle-orm";
import { auditLog, type DBAuditEntry } from "../schema.js";
import type { TenantContext, TenantTx } from "../tenant.js";

/** Every mutating operation writes exactly one of these. */
export type AuditAction =
  | "workspace.created"
  | "workspace.updated"
  | "workspace.rolled_back"
  | "workspace.viewed"
  | "workspace.deleted"
  | "workspace.shared"
  | "workspace.unshared"
  | "workspace.visibility_changed"
  | "workspace.duplicated"
  /** A save the server refused (non-BUILD verdict) — no version was written. */
  | "workspace.spec_rejected"
  | "contract.registered"
  | "contract.updated"
  | "contract.removed"
  /** A tenant was self-provisioned at signup (#91); actor is the owner user. */
  | "tenant.provisioned";

export interface WriteAuditParams {
  action: AuditAction;
  workspaceId?: string;
  detail?: Record<string, unknown>;
}

/**
 * Append an audit entry for the acting user. Called inside the same
 * transaction as the mutation it records, so the trail can never miss a
 * committed change.
 * @returns The inserted audit row.
 */
export async function writeAudit(
  tx: TenantTx,
  ctx: TenantContext,
  params: WriteAuditParams,
): Promise<DBAuditEntry> {
  const [entry] = await tx
    .insert(auditLog)
    .values({
      tenantId: ctx.tenantId,
      workspaceId: params.workspaceId ?? null,
      actorUserId: ctx.userId,
      action: params.action,
      detail: params.detail ?? {},
    })
    .returning();
  if (!entry) {
    throw new Error("Failed to write audit entry");
  }
  return entry;
}

export interface ListAuditParams {
  workspaceId?: string;
  action?: AuditAction;
  limit?: number;
}

/**
 * List audit entries for the tenant, newest first (RLS scopes the tenant).
 * @returns Audit rows, optionally filtered to one workspace and/or action.
 */
export async function listAuditEntries(
  tx: TenantTx,
  params: ListAuditParams = {},
): Promise<DBAuditEntry[]> {
  const filters = [
    params.workspaceId ? eq(auditLog.workspaceId, params.workspaceId) : undefined,
    params.action ? eq(auditLog.action, params.action) : undefined,
  ].filter((f) => f !== undefined);
  return await tx
    .select()
    .from(auditLog)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(auditLog.id))
    .limit(params.limit ?? 100);
}
