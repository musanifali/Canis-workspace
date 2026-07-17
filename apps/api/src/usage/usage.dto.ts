import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { z } from "zod";

export const recordGenerationBodySchema = z
  .object({
    workspaceId: z.string().min(1).max(200).optional(),
    costCents: z.number().int().min(0).max(1_000_000).optional(),
  })
  .strict();
export type RecordGenerationBody = z.infer<typeof recordGenerationBodySchema>;

export class GenerationAllowanceDto {
  @ApiProperty({ type: Boolean }) allowed!: boolean;
  @ApiPropertyOptional({ type: String, enum: ["budget_exceeded", "rate_limited"] })
  reason?: string;
  @ApiProperty({
    type: Number,
    nullable: true,
    description: "Generations left this month; null = unlimited budget.",
  })
  remainingThisMonth!: number | null;
  @ApiProperty({ type: Number }) remainingThisMinute!: number;
}

export class RecordGenerationResponseDto {
  @ApiProperty({ type: GenerationAllowanceDto })
  allowance!: GenerationAllowanceDto;
}

export class UsageMonthDto {
  @ApiProperty({ type: Number }) generations!: number;
  @ApiProperty({ type: Number }) costCents!: number;
}

export class UsageWorkspaceRowDto {
  @ApiProperty({
    type: String,
    nullable: true,
    description: "Null for generations not attributed to a workspace.",
  })
  workspaceId!: string | null;
  @ApiProperty({ type: Number }) generations!: number;
  @ApiProperty({ type: Number }) costCents!: number;
}

export class UsageSummaryDto {
  @ApiProperty({ type: UsageMonthDto }) month!: UsageMonthDto;
  @ApiProperty({ type: [UsageWorkspaceRowDto] })
  perWorkspace!: UsageWorkspaceRowDto[];
  @ApiProperty({
    type: Number,
    description:
      "Always 0 — saved workspaces cost nothing to open (two-phase design); " +
      "reads are never metered.",
  })
  readCostCents!: number;
}
