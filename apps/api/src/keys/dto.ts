/**
 * /v1/keys shapes (#92 key-management UI). Metadata never includes the hash;
 * the raw key appears exactly once, in the mint response.
 */
import { ApiProperty } from "@nestjs/swagger";
import { z } from "zod";

export const mintKeyBodySchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    scope: z.enum(["runtime", "admin"]),
  })
  .strict();
export type MintKeyBody = z.infer<typeof mintKeyBodySchema>;

export class ApiKeyDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String }) name!: string;
  @ApiProperty({ type: String, enum: ["runtime", "admin"] }) scope!:
    | "runtime"
    | "admin";
  @ApiProperty({ type: String, format: "date-time" }) createdAt!: string;
  @ApiProperty({ type: String, format: "date-time", nullable: true })
  lastUsedAt!: string | null;
  @ApiProperty({ type: String, format: "date-time", nullable: true })
  revokedAt!: string | null;
}

export class MintedKeyDto extends ApiKeyDto {
  @ApiProperty({
    type: String,
    description: "The raw key — shown exactly once, never retrievable again.",
  })
  rawKey!: string;
}
