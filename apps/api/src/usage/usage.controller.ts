import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  Inject,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from "@nestjs/swagger";
import {
  GenerationLimitError,
  getGenerationAllowance,
  getUsageSummary,
  recordGenerationUsage,
  withTenant,
  type WorkspaceDbClient,
} from "@workspace-engine/db";
import type { Request } from "express";
import { RequireScope, TenantGuard, tenantCtxOf } from "../auth/tenant.guard.js";
import { DB_CLIENT } from "../db.provider.js";
import { ZodValidationPipe } from "../zod-pipe.js";
import {
  GenerationAllowanceDto,
  recordGenerationBodySchema,
  RecordGenerationResponseDto,
  UsageSummaryDto,
  type RecordGenerationBody,
} from "./usage.dto.js";

const recordBodyPipe = new ZodValidationPipe(recordGenerationBodySchema);

@ApiTags("usage")
@ApiHeader({ name: "x-api-key", description: "Tenant API key", required: true })
@ApiHeader({
  name: "x-user-id",
  description: "Acting end user within the tenant",
  required: true,
})
@UseGuards(TenantGuard)
@Controller("usage")
export class UsageController {
  constructor(
    @Inject(DB_CLIENT) private readonly client: WorkspaceDbClient,
  ) {}

  @Get("allowance")
  @ApiOperation({
    summary:
      "Pre-check whether the acting user may run a generation (gate the UI " +
      "before burning a model call)",
  })
  @ApiOkResponse({ type: GenerationAllowanceDto })
  async allowance(@Req() req: Request): Promise<GenerationAllowanceDto> {
    const ctx = tenantCtxOf(req);
    return await withTenant(this.client.db, ctx, (tx) =>
      getGenerationAllowance(tx, ctx),
    );
  }

  @Post("generation")
  @HttpCode(201)
  @ApiOperation({
    summary: "Record one generation event (enforces budget + rate limit)",
  })
  @ApiCreatedResponse({ type: RecordGenerationResponseDto })
  @ApiTooManyRequestsResponse({
    description:
      "Budget exhausted or rate limited — body carries a machine-readable " +
      "`code` (budget_exceeded | rate_limited) so UIs surface a clear state, " +
      "never a silent failure.",
  })
  async record(
    @Req() req: Request,
    @Body(recordBodyPipe) body: RecordGenerationBody,
  ): Promise<RecordGenerationResponseDto> {
    const ctx = tenantCtxOf(req);
    try {
      const result = await withTenant(this.client.db, ctx, (tx) =>
        recordGenerationUsage(tx, ctx, body),
      );
      return { allowance: result.allowance };
    } catch (error) {
      if (error instanceof GenerationLimitError) {
        throw new HttpException(
          { statusCode: 429, code: error.reason, message: error.message },
          429,
        );
      }
      throw error;
    }
  }

  @Get("summary")
  @RequireScope("admin")
  @ApiOperation({
    summary:
      "This month's cost picture: totals + per-workspace breakdown (reads " +
      "always cost zero)",
  })
  @ApiOkResponse({ type: UsageSummaryDto })
  async summary(@Req() req: Request): Promise<UsageSummaryDto> {
    const ctx = tenantCtxOf(req);
    return await withTenant(this.client.db, ctx, (tx) => getUsageSummary(tx));
  }
}
