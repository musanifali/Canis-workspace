/**
 * Workspace access resolution (#28) — permission checks live here in the
 * operations layer, on top of #25's tenant-level RLS.
 *
 * Semantics:
 * - The owner has every right.
 * - `visibility: "org"` grants every tenant user VIEW.
 * - Explicit shares grant their role to a user, or to every member of a team
 *   (membership is caller-supplied via TenantContext.teamIds — the same
 *   trust model as the acting user id itself).
 * - `visibility: "team"` and `"private"` are enforced identically (explicit
 *   shares only); "team" is the convention for share-with-teams workspaces.
 *
 * Denials: no VIEW access reads as not-found (existence is not revealed);
 * VIEW without the required right is a WorkspaceForbiddenError (HTTP 403).
 */
import { and, eq, inArray, or, type SQL } from "drizzle-orm";
import { workspaceShares, type DBWorkspace } from "../schema.js";
import type { TenantContext, TenantTx } from "../tenant.js";

export type WorkspaceRole = "owner" | "editor" | "viewer";

/** Thrown when the principal can view a workspace but lacks the needed right. */
export class WorkspaceForbiddenError extends Error {
  constructor(
    readonly id: string,
    readonly needed: "edit" | "owner",
  ) {
    super(`workspace "${id}": ${needed} access required`);
    this.name = "WorkspaceForbiddenError";
  }
}

/** Share rows that apply to this principal (user match or team match). */
export function shareMatchFor(ctx: TenantContext): SQL {
  const teamIds = ctx.teamIds ?? [];
  const userMatch = and(
    eq(workspaceShares.subjectType, "user"),
    eq(workspaceShares.subjectId, ctx.userId),
  );
  if (teamIds.length === 0) {
    return userMatch as SQL;
  }
  return or(
    userMatch,
    and(
      eq(workspaceShares.subjectType, "team"),
      inArray(workspaceShares.subjectId, [...teamIds]),
    ),
  ) as SQL;
}

/**
 * Resolve the principal's effective role on a workspace.
 * @returns The role, or null when the principal cannot even view it.
 */
export async function resolveWorkspaceRole(
  tx: TenantTx,
  ctx: TenantContext,
  workspace: DBWorkspace,
): Promise<WorkspaceRole | null> {
  if (workspace.ownerUserId === ctx.userId) {
    return "owner";
  }
  const shares = await tx
    .select({ role: workspaceShares.role })
    .from(workspaceShares)
    .where(
      and(eq(workspaceShares.workspaceId, workspace.id), shareMatchFor(ctx)),
    );
  if (shares.some((share) => share.role === "editor")) {
    return "editor";
  }
  if (shares.length > 0) {
    return "viewer";
  }
  return workspace.visibility === "org" ? "viewer" : null;
}

/** True when the role includes the right to save edits/rollbacks. */
export const canEdit = (role: WorkspaceRole): boolean => role !== "viewer";
