import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { WorkspaceSpec } from "@workspace-engine/core";
import {
  createWorkspace,
  duplicateWorkspace,
  getWorkspace,
  listWorkspaces,
  listWorkspaceShares,
  listWorkspaceVersions,
  recordWorkspaceView,
  rollbackWorkspace,
  setWorkspaceVisibility,
  shareWorkspace,
  softDeleteWorkspace,
  unshareWorkspace,
  updateWorkspaceSpec,
  withTenant,
  WorkspaceForbiddenError,
  WorkspaceNotFoundError,
  WorkspaceVersionNotFoundError,
  type StoredVerdict,
  type TenantContext,
  type WorkspaceDbClient,
} from "@workspace-engine/db";
import { DB_CLIENT } from "../db.provider.js";
import {
  toRecordDto,
  toShareDto,
  toSummaryDto,
  toVersionDto,
  type DuplicateBody,
  type SaveWorkspaceBody,
  type ShareBody,
  type VisibilityBody,
  type WorkspaceRecordDto,
  type WorkspaceShareDto,
  type WorkspaceSummaryDto,
  type WorkspaceVersionDto,
} from "./dto.js";

/**
 * The specs this API stores arrived through the zod-validated request body
 * (core's workspaceSpecSchema), so shape validity is already established;
 * contract-level gating (BUILD) happens at the save gate client-side today.
 */
const SHAPE_CHECKED_VERDICT: StoredVerdict = { verdict: "BUILD", notes: [] };

@Injectable()
export class WorkspacesService {
  constructor(
    @Inject(DB_CLIENT) private readonly client: WorkspaceDbClient,
  ) {}

  async list(ctx: TenantContext): Promise<WorkspaceSummaryDto[]> {
    const rows = await withTenant(this.client.db, ctx, (tx) =>
      listWorkspaces(tx, ctx),
    );
    return rows.map(toSummaryDto);
  }

  async get(ctx: TenantContext, id: string): Promise<WorkspaceRecordDto> {
    return await this.notFoundTo404(async () => {
      const result = await withTenant(this.client.db, ctx, async (tx) => {
        const found = await getWorkspace(tx, ctx, id);
        await recordWorkspaceView(tx, ctx, id);
        return found;
      });
      return toRecordDto(result);
    });
  }

  async create(
    ctx: TenantContext,
    body: SaveWorkspaceBody,
  ): Promise<WorkspaceRecordDto> {
    const result = await withTenant(this.client.db, ctx, (tx) =>
      createWorkspace(tx, ctx, {
        spec: body.spec as WorkspaceSpec,
        verdict: SHAPE_CHECKED_VERDICT,
        ...(body.prompt ? { prompt: body.prompt } : {}),
        ...(body.createdFromThreadId
          ? { createdFromThreadId: body.createdFromThreadId }
          : {}),
      }),
    );
    return toRecordDto(result);
  }

  async update(
    ctx: TenantContext,
    id: string,
    body: SaveWorkspaceBody,
  ): Promise<WorkspaceRecordDto> {
    return await this.notFoundTo404(async () => {
      const result = await withTenant(this.client.db, ctx, (tx) =>
        updateWorkspaceSpec(tx, ctx, id, {
          spec: body.spec as WorkspaceSpec,
          verdict: SHAPE_CHECKED_VERDICT,
          ...(body.prompt ? { prompt: body.prompt } : {}),
        }),
      );
      return toRecordDto(result);
    });
  }

  async remove(ctx: TenantContext, id: string): Promise<void> {
    await this.notFoundTo404(() =>
      withTenant(this.client.db, ctx, (tx) => softDeleteWorkspace(tx, ctx, id)),
    );
  }

  async versions(
    ctx: TenantContext,
    id: string,
  ): Promise<WorkspaceVersionDto[]> {
    return await this.notFoundTo404(async () => {
      const rows = await withTenant(this.client.db, ctx, (tx) =>
        listWorkspaceVersions(tx, ctx, id),
      );
      return rows.map(toVersionDto);
    });
  }

  async rollback(
    ctx: TenantContext,
    id: string,
    toVersion: number,
  ): Promise<WorkspaceRecordDto> {
    return await this.notFoundTo404(async () => {
      const result = await withTenant(this.client.db, ctx, (tx) =>
        rollbackWorkspace(tx, ctx, id, toVersion),
      );
      return toRecordDto(result);
    });
  }

  async shares(ctx: TenantContext, id: string): Promise<WorkspaceShareDto[]> {
    return await this.notFoundTo404(async () => {
      const rows = await withTenant(this.client.db, ctx, (tx) =>
        listWorkspaceShares(tx, ctx, id),
      );
      return rows.map(toShareDto);
    });
  }

  async share(
    ctx: TenantContext,
    id: string,
    body: ShareBody,
  ): Promise<WorkspaceShareDto> {
    return await this.notFoundTo404(async () => {
      const row = await withTenant(this.client.db, ctx, (tx) =>
        shareWorkspace(tx, ctx, id, body),
      );
      return toShareDto(row);
    });
  }

  async unshare(
    ctx: TenantContext,
    id: string,
    shareId: string,
  ): Promise<void> {
    const removed = await this.notFoundTo404(() =>
      withTenant(this.client.db, ctx, (tx) =>
        unshareWorkspace(tx, ctx, id, shareId),
      ),
    );
    if (!removed) {
      throw new NotFoundException(`share not found: "${shareId}"`);
    }
  }

  async setVisibility(
    ctx: TenantContext,
    id: string,
    body: VisibilityBody,
  ): Promise<WorkspaceRecordDto> {
    return await this.notFoundTo404(async () => {
      await withTenant(this.client.db, ctx, (tx) =>
        setWorkspaceVisibility(tx, ctx, id, body.visibility),
      );
      const result = await withTenant(this.client.db, ctx, (tx) =>
        getWorkspace(tx, ctx, id),
      );
      return toRecordDto(result);
    });
  }

  async duplicate(
    ctx: TenantContext,
    id: string,
    body: DuplicateBody,
  ): Promise<WorkspaceRecordDto> {
    return await this.notFoundTo404(async () => {
      const result = await withTenant(this.client.db, ctx, (tx) =>
        duplicateWorkspace(tx, ctx, id, body.title ? { title: body.title } : {}),
      );
      return toRecordDto(result);
    });
  }

  /** Translate operations-layer denials to HTTP: 404 (not-found or no view
   * access — existence stays hidden) and 403 (viewable, right missing). */
  private async notFoundTo404<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (
        error instanceof WorkspaceNotFoundError ||
        error instanceof WorkspaceVersionNotFoundError
      ) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof WorkspaceForbiddenError) {
        throw new ForbiddenException(error.message);
      }
      throw error;
    }
  }
}
