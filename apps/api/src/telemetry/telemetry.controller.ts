import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiAcceptedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
  getTelemetrySummary,
  recordTelemetryEvents,
  type WorkspaceDbClient,
} from "@workspace-engine/db";
import { TenantGuard } from "../auth/tenant.guard.js";
import { DB_CLIENT } from "../db.provider.js";
import { ZodValidationPipe } from "../zod-pipe.js";
import {
  TelemetryAcceptedDto,
  TelemetrySummaryDto,
  telemetryBatchSchema,
  type TelemetryBatch,
} from "./dto.js";

const batchPipe = new ZodValidationPipe(telemetryBatchSchema);

/**
 * Anonymous, opt-in SDK telemetry (card #52, decision D5). The API key gates
 * the endpoint against abuse; the tenant context is deliberately NOT read —
 * nothing written here can be attributed. SDKs send nothing at all unless
 * `telemetry.enabled` is explicitly set (default OFF).
 */
@ApiTags("telemetry")
@ApiHeader({ name: "x-api-key", description: "Tenant API key", required: true })
@ApiHeader({
  name: "x-user-id",
  description: "Acting end user within the tenant",
  required: true,
})
@ApiUnauthorizedResponse({ description: "Missing/unknown API key or user" })
@UseGuards(TenantGuard)
@Controller("telemetry")
export class TelemetryController {
  constructor(
    @Inject(DB_CLIENT) private readonly client: WorkspaceDbClient,
  ) {}

  @Post()
  @HttpCode(202)
  @ApiOperation({
    summary:
      "Ingest a batch of anonymous SDK events (documented schema; nothing " +
      "identifying is persisted)",
  })
  @ApiAcceptedResponse({ type: TelemetryAcceptedDto })
  async ingest(
    @Body(batchPipe) body: TelemetryBatch,
  ): Promise<TelemetryAcceptedDto> {
    const rows = await recordTelemetryEvents(this.client.db, body.events);
    return { accepted: rows.length };
  }

  @Get("summary")
  @ApiOperation({
    summary:
      "Aggregate funnel + degradation-reason counts (the internal dashboard " +
      "view; raw events are never exposed)",
  })
  @ApiOkResponse({ type: TelemetrySummaryDto })
  async summary(): Promise<TelemetrySummaryDto> {
    return await getTelemetrySummary(this.client.db);
  }
}
