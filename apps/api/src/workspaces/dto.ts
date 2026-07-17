/**
 * /v1 request & response shapes. Requests are validated with zod (the spec
 * schema is core's own — the API can't drift from Spec v1); responses are
 * swagger-decorated classes so the OpenAPI document is generated from the
 * controllers (card #26).
 */
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { workspaceSpecSchema } from "@workspace-engine/core";
import type {
  DBWorkspace,
  DBWorkspaceVersion,
  WorkspaceWithHead,
} from "@workspace-engine/db";
import { z } from "zod";

export const saveWorkspaceBodySchema = z
  .object({
    spec: workspaceSpecSchema,
    prompt: z.string().min(1).max(10_000).optional(),
    createdFromThreadId: z.string().min(1).max(200).optional(),
  })
  .strict();
export type SaveWorkspaceBody = z.infer<typeof saveWorkspaceBodySchema>;

export const rollbackBodySchema = z
  .object({ toVersion: z.number().int().min(1) })
  .strict();
export type RollbackBody = z.infer<typeof rollbackBodySchema>;

// NOTE: every @ApiProperty carries an explicit `type` — this app compiles
// without emitDecoratorMetadata (so vitest/esbuild can run it), which
// disables swagger's type inference.
export class WorkspaceSummaryDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) title!: string;
  @ApiProperty({ type: Number, description: "Epoch millis of the last save." })
  updatedAt!: number;
}

export class WorkspaceRecordDto extends WorkspaceSummaryDto {
  @ApiProperty({
    type: Object,
    description: "The validated Workspace Spec v1 document.",
  })
  spec!: Record<string, unknown>;
  @ApiProperty({ type: Number }) headVersion!: number;
  @ApiProperty({ type: String, enum: ["private", "team", "org"] })
  visibility!: string;
  @ApiProperty({ type: String }) ownerUserId!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  createdFromThreadId!: string | null;
}

export class WorkspaceVersionDto {
  @ApiProperty({ type: Number }) versionNumber!: number;
  @ApiProperty({ nullable: true, type: String }) prompt!: string | null;
  @ApiProperty({ type: String }) authorUserId!: string;
  @ApiProperty({ type: String, description: "ISO timestamp." })
  createdAt!: string;
  @ApiProperty({ type: Number }) specVersion!: number;
  @ApiProperty({
    type: Object,
    description: "The immutable spec snapshot this version stores.",
  })
  spec!: Record<string, unknown>;
}

/** Map a workspace row + its head version to the API record shape. */
export function toRecordDto(result: WorkspaceWithHead): WorkspaceRecordDto {
  const { workspace, head } = result;
  return {
    id: workspace.id,
    title: workspace.title,
    updatedAt: workspace.updatedAt.getTime(),
    spec: head.spec as unknown as Record<string, unknown>,
    headVersion: workspace.headVersion,
    visibility: workspace.visibility,
    ownerUserId: workspace.ownerUserId,
    createdFromThreadId: workspace.createdFromThreadId,
  };
}

/** Map a workspace row to the API summary shape. */
export function toSummaryDto(workspace: DBWorkspace): WorkspaceSummaryDto {
  return {
    id: workspace.id,
    title: workspace.title,
    updatedAt: workspace.updatedAt.getTime(),
  };
}

/** Map a version row to the API version shape. */
export function toVersionDto(version: DBWorkspaceVersion): WorkspaceVersionDto {
  return {
    versionNumber: version.versionNumber,
    prompt: version.prompt,
    authorUserId: version.authorUserId,
    createdAt: version.createdAt.toISOString(),
    specVersion: version.specVersion,
    spec: version.spec as unknown as Record<string, unknown>,
  };
}
