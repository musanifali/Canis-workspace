import {
  parseSpec,
  serializeSpec,
  type WorkspaceSpec,
} from "@workspace-engine/core";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  workspaces,
  workspaceVersions,
  type DBWorkspace,
  type DBWorkspaceVersion,
  type StoredVerdict,
} from "../schema.js";
import type { TenantContext, TenantTx } from "../tenant.js";
import { writeAudit } from "./audit.js";

/** Thrown when a workspace id doesn't exist (or is soft-deleted) for this tenant. */
export class WorkspaceNotFoundError extends Error {
  constructor(readonly id: string) {
    super(`workspace not found: "${id}"`);
    this.name = "WorkspaceNotFoundError";
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
      ...(params.createdFromThreadId
        ? { createdFromThreadId: params.createdFromThreadId }
        : {}),
    },
  });

  return { workspace, head };
}

/**
 * Fetch a workspace and its head version. RLS scopes the tenant; soft-deleted
 * workspaces are treated as not found.
 * @returns The workspace with its head version.
 * @throws {WorkspaceNotFoundError} For unknown or deleted ids.
 */
export async function getWorkspace(
  tx: TenantTx,
  id: string,
): Promise<WorkspaceWithHead> {
  const [workspace] = await tx
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.id, id), isNull(workspaces.deletedAt)));
  if (!workspace) {
    throw new WorkspaceNotFoundError(id);
  }

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
 * List the tenant's live workspaces, most recently updated first. Returns
 * workspace rows only (no spec payload) — cheap listing for summaries.
 * @returns Workspace rows.
 */
export async function listWorkspaces(tx: TenantTx): Promise<DBWorkspace[]> {
  return await tx
    .select()
    .from(workspaces)
    .where(isNull(workspaces.deletedAt))
    .orderBy(desc(workspaces.updatedAt));
}

export interface UpdateWorkspaceSpecParams {
  spec: WorkspaceSpec;
  verdict: StoredVerdict;
  prompt?: string;
}

/**
 * Save an edit: appends a new immutable version and repoints the head.
 * The existing rows are never rewritten.
 * @returns The workspace with its new head version.
 * @throws {WorkspaceNotFoundError} For unknown or deleted ids.
 */
export async function updateWorkspaceSpec(
  tx: TenantTx,
  ctx: TenantContext,
  id: string,
  params: UpdateWorkspaceSpecParams,
): Promise<WorkspaceWithHead> {
  const spec = cloneSpec(params.spec);
  const locked = await lockWorkspace(tx, id);

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
    detail: { version: nextVersion, title: spec.title },
  });

  return { workspace, head };
}

/**
 * Soft-delete a workspace. Versions and audit history remain (append-only);
 * the workspace disappears from list/get.
 * @throws {WorkspaceNotFoundError} For unknown or already-deleted ids.
 */
export async function softDeleteWorkspace(
  tx: TenantTx,
  ctx: TenantContext,
  id: string,
): Promise<void> {
  const locked = await lockWorkspace(tx, id);
  await tx
    .update(workspaces)
    .set({ deletedAt: new Date() })
    .where(eq(workspaces.id, locked.id));
  await writeAudit(tx, ctx, { action: "workspace.deleted", workspaceId: id });
}

/**
 * Lock the live workspace row for the rest of the transaction, serializing
 * concurrent version appends against the same workspace.
 * @returns The locked workspace row.
 * @throws {WorkspaceNotFoundError} For unknown or deleted ids.
 */
async function lockWorkspace(tx: TenantTx, id: string): Promise<DBWorkspace> {
  const [workspace] = await tx
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.id, id), isNull(workspaces.deletedAt)))
    .for("update");
  if (!workspace) {
    throw new WorkspaceNotFoundError(id);
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
