/**
 * Share management (#28). All owner-only, enforced here in the operations
 * layer via requireWorkspaceAccess; RLS (#25) already fences the tenant.
 */
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  workspaces,
  workspaceShares,
  type DBWorkspace,
  type DBWorkspaceShare,
} from "../schema.js";
import type { TenantContext, TenantTx } from "../tenant.js";
import { writeAudit } from "./audit.js";
import { requireWorkspaceAccess } from "./workspaces.js";

export interface ShareWorkspaceParams {
  subjectType: "user" | "team";
  subjectId: string;
  role: "viewer" | "editor";
}

/**
 * Grant (or re-grant with a new role) access to a user or team. Owner only.
 * @returns The share row.
 */
export async function shareWorkspace(
  tx: TenantTx,
  ctx: TenantContext,
  workspaceId: string,
  params: ShareWorkspaceParams,
): Promise<DBWorkspaceShare> {
  await requireWorkspaceAccess(tx, ctx, workspaceId, "owner");

  const [existing] = await tx
    .select()
    .from(workspaceShares)
    .where(
      and(
        eq(workspaceShares.workspaceId, workspaceId),
        eq(workspaceShares.subjectType, params.subjectType),
        eq(workspaceShares.subjectId, params.subjectId),
      ),
    );

  const share = existing
    ? (
        await tx
          .update(workspaceShares)
          .set({ role: params.role })
          .where(eq(workspaceShares.id, existing.id))
          .returning()
      )[0]
    : (
        await tx
          .insert(workspaceShares)
          .values({
            id: `shr_${randomUUID()}`,
            workspaceId,
            tenantId: ctx.tenantId,
            subjectType: params.subjectType,
            subjectId: params.subjectId,
            role: params.role,
            createdByUserId: ctx.userId,
          })
          .returning()
      )[0];
  if (!share) {
    throw new Error(`Failed to share workspace "${workspaceId}"`);
  }

  await writeAudit(tx, ctx, {
    action: "workspace.shared",
    workspaceId,
    detail: {
      subjectType: params.subjectType,
      subjectId: params.subjectId,
      role: params.role,
    },
  });
  return share;
}

/**
 * Revoke a share. Owner only; idempotent.
 * @returns True when a share was removed.
 */
export async function unshareWorkspace(
  tx: TenantTx,
  ctx: TenantContext,
  workspaceId: string,
  shareId: string,
): Promise<boolean> {
  await requireWorkspaceAccess(tx, ctx, workspaceId, "owner");
  const deleted = await tx
    .delete(workspaceShares)
    .where(
      and(
        eq(workspaceShares.id, shareId),
        eq(workspaceShares.workspaceId, workspaceId),
      ),
    )
    .returning();
  const share = deleted[0];
  if (!share) {
    return false;
  }
  await writeAudit(tx, ctx, {
    action: "workspace.unshared",
    workspaceId,
    detail: { subjectType: share.subjectType, subjectId: share.subjectId },
  });
  return true;
}

/**
 * List a workspace's shares. Owner only (the grant list is the owner's).
 * @returns Share rows.
 */
export async function listWorkspaceShares(
  tx: TenantTx,
  ctx: TenantContext,
  workspaceId: string,
): Promise<DBWorkspaceShare[]> {
  await requireWorkspaceAccess(tx, ctx, workspaceId, "owner");
  return await tx
    .select()
    .from(workspaceShares)
    .where(eq(workspaceShares.workspaceId, workspaceId));
}

/**
 * Change a workspace's visibility (private/team/org). Owner only.
 * @returns The updated workspace row.
 */
export async function setWorkspaceVisibility(
  tx: TenantTx,
  ctx: TenantContext,
  workspaceId: string,
  visibility: "private" | "team" | "org",
): Promise<DBWorkspace> {
  const current = await requireWorkspaceAccess(tx, ctx, workspaceId, "owner", {
    lock: true,
  });
  if (current.visibility === visibility) {
    return current;
  }
  const [updated] = await tx
    .update(workspaces)
    .set({ visibility })
    .where(eq(workspaces.id, workspaceId))
    .returning();
  if (!updated) {
    throw new Error(`Failed to change visibility of "${workspaceId}"`);
  }
  await writeAudit(tx, ctx, {
    action: "workspace.visibility_changed",
    workspaceId,
    detail: { from: current.visibility, to: visibility },
  });
  return updated;
}
