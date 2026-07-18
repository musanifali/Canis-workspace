/**
 * /v1/telemetry shapes (card #52, decision D5). The ingest body is the
 * DOCUMENTED anonymous schema — nothing here identifies a tenant or user,
 * and the handler never persists the caller's identity. Event names are
 * pinned to the published set so the sink can't silently grow into a
 * general-purpose logger.
 */
import { ApiProperty } from "@nestjs/swagger";
import { z } from "zod";

/** The published event set — see the docs' telemetry reference. */
export const telemetryEventNameSchema = z.enum([
  "provider.mounted",
  "sandbox.rendered",
  "store.first_save",
  "block.degraded",
  "spec.rejected",
]);

export const telemetryBatchSchema = z
  .object({
    events: z
      .array(
        z
          .object({
            event: telemetryEventNameSchema,
            props: z.record(z.unknown()).optional(),
            sdkVersion: z.string().max(40).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict();
export type TelemetryBatch = z.infer<typeof telemetryBatchSchema>;

export class TelemetryAcceptedDto {
  @ApiProperty({ type: Number }) accepted!: number;
}

export class TelemetryEventCountDto {
  @ApiProperty({ type: String }) event!: string;
  @ApiProperty({ type: Number }) count!: number;
}

export class TelemetryReasonCountDto {
  @ApiProperty({ type: String }) reason!: string;
  @ApiProperty({ type: Number }) count!: number;
}

export class TelemetrySummaryDto {
  @ApiProperty({ type: [TelemetryEventCountDto] })
  byEvent!: TelemetryEventCountDto[];
  @ApiProperty({
    type: [TelemetryReasonCountDto],
    description: "block.degraded events by reason — the error-frequency view.",
  })
  degradedByReason!: TelemetryReasonCountDto[];
}
