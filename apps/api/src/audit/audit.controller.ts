import { Controller, Get, Inject, Query, Req, UseGuards } from "@nestjs/common";
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
  listAuditEntries,
  withTenant,
  type WorkspaceDbClient,
} from "@workspace-engine/db";
import type { Request } from "express";
import { TenantGuard, tenantCtxOf } from "../auth/tenant.guard.js";
import { DB_CLIENT } from "../db.provider.js";
import { ZodValidationPipe } from "../zod-pipe.js";
import {
  AuditEntryDto,
  auditActionSchema,
  listAuditQuerySchema,
  toAuditEntryDto,
  type ListAuditQuery,
} from "./dto.js";

const listQueryPipe = new ZodValidationPipe(listAuditQuerySchema);

@ApiTags("audit")
@ApiHeader({ name: "x-api-key", description: "Tenant API key", required: true })
@ApiHeader({
  name: "x-user-id",
  description: "Acting end user within the tenant",
  required: true,
})
@ApiUnauthorizedResponse({ description: "Missing/unknown API key or user" })
@UseGuards(TenantGuard)
@Controller("audit")
export class AuditController {
  constructor(
    @Inject(DB_CLIENT) private readonly client: WorkspaceDbClient,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      "Page over the tenant's audit trail, newest first (append-only at the " +
      "database layer; server-computed verdicts per card #87)",
  })
  @ApiQuery({ name: "workspaceId", required: false, type: String })
  @ApiQuery({
    name: "action",
    required: false,
    enum: auditActionSchema.options,
  })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiOkResponse({ type: [AuditEntryDto] })
  async list(
    @Req() req: Request,
    @Query(listQueryPipe) query: ListAuditQuery,
  ): Promise<AuditEntryDto[]> {
    const ctx = tenantCtxOf(req);
    const rows = await withTenant(this.client.db, ctx, (tx) =>
      listAuditEntries(tx, {
        ...(query.workspaceId ? { workspaceId: query.workspaceId } : {}),
        ...(query.action ? { action: query.action } : {}),
        ...(query.limit ? { limit: query.limit } : {}),
      }),
    );
    return rows.map(toAuditEntryDto);
  }
}
