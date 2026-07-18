/**
 * /v1/audit shapes. Read-only: the audit trail is append-only at the database
 * layer (policy-absence + REVOKE); this surface only pages over it.
 */
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { AuditAction, DBAuditEntry } from "@workspace-engine/db";
import { z } from "zod";

/** Mirrors the operations layer's AuditAction union (compile-checked below). */
export const auditActionSchema = z.enum([
  "workspace.created",
  "workspace.updated",
  "workspace.rolled_back",
  "workspace.viewed",
  "workspace.deleted",
  "workspace.shared",
  "workspace.unshared",
  "workspace.visibility_changed",
  "workspace.duplicated",
  "workspace.spec_rejected",
  "contract.registered",
  "contract.updated",
  "contract.removed",
] as const satisfies readonly AuditAction[]);

export const listAuditQuerySchema = z
  .object({
    workspaceId: z.string().min(1).max(200).optional(),
    action: auditActionSchema.optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
  })
  .strict();
export type ListAuditQuery = z.infer<typeof listAuditQuerySchema>;

export class AuditEntryDto {
  @ApiProperty({
    type: String,
    description: "Monotonic entry id (bigserial, serialized as a string).",
  })
  id!: string;
  @ApiPropertyOptional({ nullable: true, type: String })
  workspaceId!: string | null;
  @ApiProperty({ type: String }) actorUserId!: string;
  @ApiProperty({ type: String, enum: auditActionSchema.options })
  action!: string;
  @ApiProperty({
    type: Object,
    description:
      "Action-specific payload. For workspace.spec_rejected: the verdict " +
      "plus the validator's structured errors/questions.",
  })
  detail!: Record<string, unknown>;
  @ApiProperty({ type: String, description: "ISO timestamp." })
  createdAt!: string;
}

/** Map an audit_log row to the API shape. */
export function toAuditEntryDto(row: DBAuditEntry): AuditEntryDto {
  return {
    id: row.id.toString(),
    workspaceId: row.workspaceId,
    actorUserId: row.actorUserId,
    action: row.action,
    detail: row.detail as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
  };
}
