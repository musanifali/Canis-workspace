import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  reviveContract,
  validateSpec,
  type EntityContract,
  type ValidationVerdict,
  type WorkspaceSpec,
} from "@workspace-engine/core";
import {
  createWorkspace,
  duplicateWorkspace,
  getWorkspace,
  listDataContracts,
  listWorkspaces,
  listWorkspaceShares,
  listWorkspaceVersions,
  recordWorkspaceView,
  requireWorkspaceAccess,
  rollbackWorkspace,
  setWorkspaceVisibility,
  shareWorkspace,
  softDeleteWorkspace,
  unshareWorkspace,
  updateWorkspaceSpec,
  withTenant,
  writeAudit,
  WorkspaceForbiddenError,
  WorkspaceNotFoundError,
  WorkspaceVersionNotFoundError,
  type StoredVerdict,
  type TenantContext,
  type TenantTx,
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

/** A verdict the server refuses to persist, mapped to a machine-readable 422. */
type NonBuildVerdict = Extract<
  ValidationVerdict,
  { verdict: "REJECT" | "CLARIFY" }
>;

/**
 * Internal carrier for a refused save. Thrown inside the save transaction
 * (which rolls back), caught at the create/update boundary where the refusal
 * is audited in its OWN transaction — an entry written inside the aborted one
 * would vanish with it.
 */
class SpecVerdictRejection extends Error {
  constructor(readonly result: NonBuildVerdict) {
    super(`spec verdict ${result.verdict}`);
    this.name = "SpecVerdictRejection";
  }
}

/**
 * Turn a non-BUILD verdict into a machine-readable 422, matching this API's
 * error-DTO convention (see the usage ledger's 429: a `{ statusCode, code,
 * message }` body). CLARIFY/REJECT carry the validator's own questions/errors
 * so a client sees the same actionable detail the render-path gate produces.
 */
function specVerdictException(verdict: NonBuildVerdict): HttpException {
  const status = HttpStatus.UNPROCESSABLE_ENTITY;
  if (verdict.verdict === "REJECT") {
    return new HttpException(
      {
        statusCode: status,
        code: "spec_rejected",
        verdict: "REJECT",
        message:
          "spec rejected: it references data, fields, operators, or blocks " +
          "outside this tenant's contracts and policy",
        errors: verdict.errors,
      },
      status,
    );
  }
  return new HttpException(
    {
      statusCode: status,
      code: "spec_needs_clarification",
      verdict: "CLARIFY",
      message: "spec is under-determined and cannot be saved as-is",
      questions: verdict.questions,
    },
    status,
  );
}

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
    const result = await this.auditingRejections(ctx, undefined, () =>
      withTenant(this.client.db, ctx, async (tx) => {
        const gated = await this.gateSpec(tx, ctx, body.spec);
        return createWorkspace(tx, ctx, {
          spec: gated.spec,
          verdict: gated.verdict,
          ...(body.prompt ? { prompt: body.prompt } : {}),
          ...(body.createdFromThreadId
            ? { createdFromThreadId: body.createdFromThreadId }
            : {}),
        });
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
      const result = await this.auditingRejections(ctx, id, () =>
        withTenant(this.client.db, ctx, async (tx) => {
          // Authorize before gating content: a viewer/cross-tenant caller gets
          // 403/404 (existence semantics preserved), not a spec-validity signal.
          // The lock also serializes the version append across this transaction.
          await requireWorkspaceAccess(tx, ctx, id, "edit", { lock: true });
          const gated = await this.gateSpec(tx, ctx, body.spec);
          return updateWorkspaceSpec(tx, ctx, id, {
            spec: gated.spec,
            verdict: gated.verdict,
            ...(body.prompt ? { prompt: body.prompt } : {}),
          });
        }),
      );
      return toRecordDto(result);
    });
  }

  /**
   * Re-gate a submitted spec server-side with the SAME `validateSpec` the
   * render path uses (card #87), against the tenant's own registered
   * contracts (RLS-scoped `data_contracts`). Only a BUILD is persisted; the
   * stored verdict is the one the validator computed, never a client-asserted
   * one. A CLARIFY/REJECT — including a spec that binds an entity the tenant
   * has no contract for — throws a 422 and nothing is written (this runs
   * inside the create/update transaction, before any insert).
   * @returns The normalized (revalidated) spec and its real BUILD verdict.
   * @throws {HttpException} 422 for any non-BUILD verdict.
   */
  private async gateSpec(
    tx: TenantTx,
    ctx: TenantContext,
    spec: WorkspaceSpec,
  ): Promise<{ spec: WorkspaceSpec; verdict: StoredVerdict }> {
    const contracts: Record<string, EntityContract> = {};
    for (const row of await listDataContracts(tx)) {
      contracts[row.entityName] = reviveContract(row.definition);
    }

    const result = validateSpec(spec, { contracts });
    if (result.verdict !== "BUILD") {
      throw new SpecVerdictRejection(result);
    }
    return {
      spec: result.spec,
      verdict: { verdict: "BUILD", notes: result.notes },
    };
  }

  /**
   * Run a save attempt; when the gate refuses it, record the refusal on the
   * audit trail (card #31's rejected-capabilities report reads these) and
   * surface the 422. The audit write happens after the aborted save
   * transaction, in its own — and is best-effort: a failure to audit must not
   * mask the 422 the caller needs.
   */
  private async auditingRejections<T>(
    ctx: TenantContext,
    workspaceId: string | undefined,
    run: () => Promise<T>,
  ): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (!(error instanceof SpecVerdictRejection)) {
        throw error;
      }
      const { result } = error;
      const detail =
        result.verdict === "REJECT"
          ? { verdict: result.verdict, errors: result.errors }
          : { verdict: result.verdict, questions: result.questions };
      try {
        await withTenant(this.client.db, ctx, (tx) =>
          writeAudit(tx, ctx, {
            action: "workspace.spec_rejected",
            ...(workspaceId ? { workspaceId } : {}),
            detail: detail as unknown as Record<string, unknown>,
          }),
        );
      } catch {
        // Auditing is observability, not the contract: the 422 wins.
      }
      throw specVerdictException(result);
    }
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
