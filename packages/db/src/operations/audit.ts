import { desc, eq } from "drizzle-orm";
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
  | "workspace.duplicated"
  | "contract.registered"
  | "contract.updated"
  | "contract.removed";

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
  limit?: number;
}

/**
 * List audit entries for the tenant, newest first (RLS scopes the tenant).
 * @returns Audit rows, optionally filtered to one workspace.
 */
export async function listAuditEntries(
  tx: TenantTx,
  params: ListAuditParams = {},
): Promise<DBAuditEntry[]> {
  const workspaceFilter = params.workspaceId
    ? eq(auditLog.workspaceId, params.workspaceId)
    : undefined;
  return await tx
    .select()
    .from(auditLog)
    .where(workspaceFilter)
    .orderBy(desc(auditLog.id))
    .limit(params.limit ?? 100);
}
