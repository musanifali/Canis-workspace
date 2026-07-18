/**
 * /v1/contracts request & response shapes. The definition payload is the
 * serialized declarative surface of a `defineEntity` contract (see core's
 * serializeContract) — the vendor's executable `fetch` never leaves their
 * infrastructure (ADR-4). Deep validity is enforced by reviving the
 * definition with core's own `reviveContract` before it is stored.
 */
import { ApiProperty } from "@nestjs/swagger";
import type { DBDataContract } from "@workspace-engine/db";
import { z } from "zod";

/** Mirrors core's binding entity-name grammar (spec/block.ts). */
export const entityNameSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-zA-Z0-9_]*$/, "expected an entity name like case");

export const upsertContractBodySchema = z
  .object({ definition: z.record(z.unknown()) })
  .strict();
export type UpsertContractBody = z.infer<typeof upsertContractBodySchema>;

export class DataContractDto {
  @ApiProperty({ type: String }) entityName!: string;
  @ApiProperty({
    type: Object,
    description:
      "Serialized defineEntity surface (fields, kinds, capabilities) — " +
      "revivable with core's reviveContract.",
  })
  definition!: Record<string, unknown>;
  @ApiProperty({ type: String, description: "ISO timestamp." })
  createdAt!: string;
  @ApiProperty({ type: String, description: "ISO timestamp." })
  updatedAt!: string;
}

/** Map a data_contracts row to the API shape. */
export function toContractDto(row: DBDataContract): DataContractDto {
  return {
    entityName: row.entityName,
    definition: row.definition as Record<string, unknown>,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
