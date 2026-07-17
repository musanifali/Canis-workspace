import {
  parseSpec,
  serializeSpec,
  type WorkspaceSpec,
} from "@workspace-engine/core";
import { and, desc, eq, exists, isNull, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  workspaces,
  workspaceShares,
  workspaceVersions,
  type DBWorkspace,
  type DBWorkspaceVersion,
  type StoredVerdict,
} from "../schema.js";
import type { TenantContext, TenantTx } from "../tenant.js";
import {
  canEdit,
  resolveWorkspaceRole,
  shareMatchFor,
  WorkspaceForbiddenError,
  type WorkspaceRole,
} from "./access.js";
import { writeAudit } from "./audit.js";

/** Thrown when a workspace id doesn't exist (or is soft-deleted) for this tenant. */
export class WorkspaceNotFoundError extends Error {
  constructor(readonly id: string) {
    super(`workspace not found: "${id}"`);
    this.name = "WorkspaceNotFoundError";
  }
}

/** Thrown when a workspace exists but the requested version number doesn't. */
export class WorkspaceVersionNotFoundError extends Error {
  constructor(
    readonly workspaceId: string,
    readonly versionNumber: number,
  ) {
    super(
      `workspace "${workspaceId}" has no version ${versionNumber}`,
    );
    this.name = "WorkspaceVersionNotFoundError";
  }
}

/** A workspace with the version its head currently points at. */
export interface WorkspaceWithHead {
  workspace: DBWorkspace;
  head: DBWorkspaceVersion;
}

export interface CreateWorkspaceParams {
  /** A validated (BUILD-verdict) Spec v1 document. */
  spec: WorkspaceSpec;
  verdict: StoredVerdict;
  /** The NL prompt that produced the spec; omit for manual/imported specs. */
  prompt?: string;
  /** Tambo thread the workspace was generated in (card #24 checklist). */
  createdFromThreadId?: string;
}

/**
 * Canonical round-trip: detaches the stored spec from caller-held objects and
 * re-asserts shape validity at the persistence boundary (same idiom as the
 * SDK's in-memory store).
 */
function cloneSpec(spec: WorkspaceSpec): WorkspaceSpec {
  return parseSpec(serializeSpec(spec));
}

/**
 * Create a workspace: the workspace row (head_version = 1), its immutable
 * version 1 snapshot, and the audit entry, all in the ambient transaction.
 * @returns The created workspace with its head version.
 */
export async function createWorkspace(
  tx: TenantTx,
  ctx: TenantContext,
  params: CreateWorkspaceParams,
): Promise<WorkspaceWithHead> {
  const spec = cloneSpec(params.spec);
  const workspaceId = `ws_${randomUUID()}`;

  const [workspace] = await tx
    .insert(workspaces)
    .values({
      id: workspaceId,
      tenantId: ctx.tenantId,
      title: spec.title,
      headVersion: 1,
      ownerUserId: ctx.userId,
      createdFromThreadId: params.createdFromThreadId ?? null,
    })
    .returning();
  if (!workspace) {
    throw new Error(`Failed to insert workspace "${workspaceId}"`);
  }

  const head = await insertVersion(tx, ctx, {
    workspaceId,
    versionNumber: 1,
    spec,
    verdict: params.verdict,
    prompt: params.prompt,
  });

  await writeAudit(tx, ctx, {
    action: "workspace.created",
    workspaceId,
    detail: {
      version: 1,
      title: spec.title,
      ...(params.prompt ? { prompt: params.prompt } : {}),
      ...(params.createdFromThreadId
        ? { createdFromThreadId: params.createdFromThreadId }
        : {}),
    },
  });

  return { workspace, head };
}

/**
 * Fetch a workspace and its head version. RLS scopes the tenant; #28's
 * access layer scopes the principal — a workspace the principal cannot VIEW
 * reads as not found (existence is not revealed).
 * @returns The workspace with its head version.
 * @throws {WorkspaceNotFoundError} For unknown, deleted, or unviewable ids.
 */
export async function getWorkspace(
  tx: TenantTx,
  ctx: TenantContext,
  id: string,
): Promise<WorkspaceWithHead> {
  const workspace = await getViewableWorkspaceRow(tx, ctx, id);

  const [head] = await tx
    .select()
    .from(workspaceVersions)
    .where(
      and(
        eq(workspaceVersions.workspaceId, id),
        eq(workspaceVersions.versionNumber, workspace.headVersion),
      ),
    );
  if (!head) {
    throw new Error(
      `workspace "${id}" head points at missing version ${workspace.headVersion}`,
    );
  }
  return { workspace, head };
}

/**
 * List the live workspaces the principal can view (owned, org-visible, or
 * shared with them / their teams), most recently updated first. Rows only —
 * no spec payload.
 * @returns Workspace rows.
 */
export async function listWorkspaces(
  tx: TenantTx,
  ctx: TenantContext,
): Promise<DBWorkspace[]> {
  const sharedWithMe = exists(
    tx
      .select({ one: sql`1` })
      .from(workspaceShares)
      .where(
        and(
          eq(workspaceShares.workspaceId, workspaces.id),
          shareMatchFor(ctx),
        ),
      ),
  );
  return await tx
    .select()
    .from(workspaces)
    .where(
      and(
        isNull(workspaces.deletedAt),
        or(
          eq(workspaces.ownerUserId, ctx.userId),
          eq(workspaces.visibility, "org"),
          sharedWithMe,
        ),
      ),
    )
    .orderBy(desc(workspaces.updatedAt));
}

export interface UpdateWorkspaceSpecParams {
  spec: WorkspaceSpec;
  verdict: StoredVerdict;
  prompt?: string;
}

/**
 * Save an edit: appends a new immutable version and repoints the head.
 * The existing rows are never rewritten. Requires EDIT access.
 * @returns The workspace with its new head version.
 * @throws {WorkspaceNotFoundError} For unknown, deleted, or unviewable ids.
 * @throws {WorkspaceForbiddenError} For viewers.
 */
export async function updateWorkspaceSpec(
  tx: TenantTx,
  ctx: TenantContext,
  id: string,
  params: UpdateWorkspaceSpecParams,
): Promise<WorkspaceWithHead> {
  const spec = cloneSpec(params.spec);
  const locked = await requireWorkspaceAccess(tx, ctx, id, "edit", {
    lock: true,
  });

  const nextVersion = (await maxVersionNumber(tx, id)) + 1;
  const head = await insertVersion(tx, ctx, {
    workspaceId: id,
    versionNumber: nextVersion,
    spec,
    verdict: params.verdict,
    prompt: params.prompt,
  });

  const [workspace] = await tx
    .update(workspaces)
    .set({ headVersion: nextVersion, title: spec.title, updatedAt: new Date() })
    .where(eq(workspaces.id, locked.id))
    .returning();
  if (!workspace) {
    throw new Error(`Failed to repoint head of workspace "${id}"`);
  }

  await writeAudit(tx, ctx, {
    action: "workspace.updated",
    workspaceId: id,
    detail: {
      version: nextVersion,
      title: spec.title,
      ...(params.prompt ? { prompt: params.prompt } : {}),
    },
  });

  return { workspace, head };
}

/**
 * Roll back: point the head at an existing older (or newer) version. No new
 * version row is written and nothing is rewritten — history stays intact and
 * a later rollback can return to where it was.
 * @returns The workspace with its repointed head version.
 * @throws {WorkspaceNotFoundError} For unknown or deleted workspace ids.
 * @throws {WorkspaceVersionNotFoundError} When the target version doesn't exist.
 */
export async function rollbackWorkspace(
  tx: TenantTx,
  ctx: TenantContext,
  id: string,
  toVersion: number,
): Promise<WorkspaceWithHead> {
  const locked = await requireWorkspaceAccess(tx, ctx, id, "edit", {
    lock: true,
  });
  const head = await getWorkspaceVersion(tx, ctx, id, toVersion);

  const [workspace] = await tx
    .update(workspaces)
    .set({
      headVersion: toVersion,
      title: head.spec.title,
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, locked.id))
    .returning();
  if (!workspace) {
    throw new Error(`Failed to repoint head of workspace "${id}"`);
  }

  await writeAudit(tx, ctx, {
    action: "workspace.rolled_back",
    workspaceId: id,
    detail: { from: locked.headVersion, to: toVersion },
  });

  return { workspace, head };
}

/**
 * Version history for a workspace, newest first. Includes what every version
 * records: the prompt, the resolved spec, the verdict, and the author.
 * @returns Version rows.
 * @throws {WorkspaceNotFoundError} For unknown or deleted workspace ids.
 */
export async function listWorkspaceVersions(
  tx: TenantTx,
  ctx: TenantContext,
  workspaceId: string,
): Promise<DBWorkspaceVersion[]> {
  // Existence + view check keeps "unknown workspace" and "no versions" distinct.
  await getViewableWorkspaceRow(tx, ctx, workspaceId);
  return await tx
    .select()
    .from(workspaceVersions)
    .where(eq(workspaceVersions.workspaceId, workspaceId))
    .orderBy(desc(workspaceVersions.versionNumber));
}

/**
 * Fetch one specific version of a workspace.
 * @returns The version row.
 * @throws {WorkspaceVersionNotFoundError} When it doesn't exist.
 */
export async function getWorkspaceVersion(
  tx: TenantTx,
  ctx: TenantContext,
  workspaceId: string,
  versionNumber: number,
): Promise<DBWorkspaceVersion> {
  await getViewableWorkspaceRow(tx, ctx, workspaceId);
  const [version] = await tx
    .select()
    .from(workspaceVersions)
    .where(
      and(
        eq(workspaceVersions.workspaceId, workspaceId),
        eq(workspaceVersions.versionNumber, versionNumber),
      ),
    );
  if (!version) {
    throw new WorkspaceVersionNotFoundError(workspaceId, versionNumber);
  }
  return version;
}

/**
 * Record that the acting user opened a workspace (#27: audit covers viewed,
 * not just created/edited). Callers decide when a read is worth recording;
 * reads themselves stay side-effect free.
 * @throws {WorkspaceNotFoundError} For unknown or deleted workspace ids.
 */
export async function recordWorkspaceView(
  tx: TenantTx,
  ctx: TenantContext,
  id: string,
): Promise<void> {
  const workspace = await getViewableWorkspaceRow(tx, ctx, id);
  await writeAudit(tx, ctx, {
    action: "workspace.viewed",
    workspaceId: id,
    detail: { version: workspace.headVersion },
  });
}

/**
 * Soft-delete a workspace. Versions and audit history remain (append-only);
 * the workspace disappears from list/get. Owner only.
 * @throws {WorkspaceNotFoundError} For unknown, deleted, or unviewable ids.
 * @throws {WorkspaceForbiddenError} For non-owners with view access.
 */
export async function softDeleteWorkspace(
  tx: TenantTx,
  ctx: TenantContext,
  id: string,
): Promise<void> {
  const locked = await requireWorkspaceAccess(tx, ctx, id, "owner", {
    lock: true,
  });
  await tx
    .update(workspaces)
    .set({ deletedAt: new Date() })
    .where(eq(workspaces.id, locked.id));
  await writeAudit(tx, ctx, { action: "workspace.deleted", workspaceId: id });
}

/**
 * Copy another user's (viewable) workspace into a new one owned by the
 * caller — the "make me one like Sarah's but for EMEA" flow. The copied spec
 * re-enters through the same persistence gate as any create (canonical
 * parse round-trip); version history starts fresh at 1.
 * @returns The new workspace with its head version.
 * @throws {WorkspaceNotFoundError} When the source is unknown or unviewable.
 */
export async function duplicateWorkspace(
  tx: TenantTx,
  ctx: TenantContext,
  sourceId: string,
  params: { title?: string } = {},
): Promise<WorkspaceWithHead> {
  const source = await getWorkspace(tx, ctx, sourceId);
  const spec: WorkspaceSpec = {
    ...source.head.spec,
    title: params.title ?? `${source.head.spec.title} (copy)`,
  };
  const created = await createWorkspace(tx, ctx, {
    spec,
    verdict: source.head.verdict,
  });
  await writeAudit(tx, ctx, {
    action: "workspace.duplicated",
    workspaceId: created.workspace.id,
    detail: { sourceId, sourceVersion: source.head.versionNumber },
  });
  return created;
}

interface AccessOptions {
  lock?: boolean;
}

/**
 * Fetch a live workspace row and the principal's role on it; optionally
 * lock the row (FOR UPDATE) to serialize version appends. No view access
 * reads as not found — existence is never revealed.
 * @returns The row and role.
 * @throws {WorkspaceNotFoundError} Unknown, deleted, or unviewable.
 */
async function fetchWorkspaceWithRole(
  tx: TenantTx,
  ctx: TenantContext,
  id: string,
  options: AccessOptions = {},
): Promise<{ workspace: DBWorkspace; role: WorkspaceRole }> {
  const query = tx
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.id, id), isNull(workspaces.deletedAt)));
  const [workspace] = options.lock ? await query.for("update") : await query;
  if (!workspace) {
    throw new WorkspaceNotFoundError(id);
  }
  const role = await resolveWorkspaceRole(tx, ctx, workspace);
  if (!role) {
    throw new WorkspaceNotFoundError(id);
  }
  return { workspace, role };
}

async function getViewableWorkspaceRow(
  tx: TenantTx,
  ctx: TenantContext,
  id: string,
  options: AccessOptions = {},
): Promise<DBWorkspace> {
  return (await fetchWorkspaceWithRole(tx, ctx, id, options)).workspace;
}

/**
 * Fetch a workspace row and demand a right on it.
 * @returns The workspace row.
 * @throws {WorkspaceNotFoundError} Unknown, deleted, or unviewable.
 * @throws {WorkspaceForbiddenError} Viewable but lacking the right.
 */
export async function requireWorkspaceAccess(
  tx: TenantTx,
  ctx: TenantContext,
  id: string,
  needed: "edit" | "owner",
  options: AccessOptions = {},
): Promise<DBWorkspace> {
  const { workspace, role } = await fetchWorkspaceWithRole(tx, ctx, id, options);
  if (needed === "owner" && role !== "owner") {
    throw new WorkspaceForbiddenError(id, "owner");
  }
  if (needed === "edit" && !canEdit(role)) {
    throw new WorkspaceForbiddenError(id, "edit");
  }
  return workspace;
}

async function maxVersionNumber(tx: TenantTx, workspaceId: string): Promise<number> {
  const [row] = await tx
    .select({
      max: sql<number>`coalesce(max(${workspaceVersions.versionNumber}), 0)`,
    })
    .from(workspaceVersions)
    .where(eq(workspaceVersions.workspaceId, workspaceId));
  return row?.max ?? 0;
}

interface InsertVersionParams {
  workspaceId: string;
  versionNumber: number;
  spec: WorkspaceSpec;
  verdict: StoredVerdict;
  prompt?: string | undefined;
}

async function insertVersion(
  tx: TenantTx,
  ctx: TenantContext,
  params: InsertVersionParams,
): Promise<DBWorkspaceVersion> {
  const [version] = await tx
    .insert(workspaceVersions)
    .values({
      id: `wsv_${randomUUID()}`,
      workspaceId: params.workspaceId,
      tenantId: ctx.tenantId,
      versionNumber: params.versionNumber,
      spec: params.spec,
      specVersion: params.spec.specVersion,
      prompt: params.prompt ?? null,
      verdict: params.verdict,
      authorUserId: ctx.userId,
    })
    .returning();
  if (!version) {
    throw new Error(
      `Failed to insert version ${params.versionNumber} of workspace "${params.workspaceId}"`,
    );
  }
  return version;
}
