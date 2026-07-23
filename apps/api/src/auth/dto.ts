/**
 * /v1/auth shapes (#93 dashboard sessions). Login is BFF-only (provision
 * secret); the session/logout/members endpoints authenticate with the opaque
 * session token the login step returns.
 */
import { ApiProperty } from "@nestjs/swagger";
import { z } from "zod";

export const loginRequestSchema = z
  .object({
    /** Verified provider identity `"github:<id>"`. */
    externalId: z.string().min(1).max(120),
  })
  .strict();
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export class SessionUserDto {
  @ApiProperty({ type: String }) userId!: string;
  @ApiProperty({ type: String }) tenantId!: string;
  @ApiProperty({ type: String, enum: ["owner", "member"] }) role!:
    | "owner"
    | "member";
  @ApiProperty({ type: String, nullable: true }) name!: string | null;
  @ApiProperty({ type: String, nullable: true }) email!: string | null;
}

export class LoginResponseDto {
  @ApiProperty({ type: String, description: "Opaque session token for the cookie." })
  token!: string;
  @ApiProperty({ type: String, format: "date-time" }) expiresAt!: string;
  @ApiProperty({ type: SessionUserDto }) user!: SessionUserDto;
}

export class MemberDto {
  @ApiProperty({ type: String }) id!: string;
  @ApiProperty({ type: String, nullable: true }) name!: string | null;
  @ApiProperty({ type: String, nullable: true }) email!: string | null;
  @ApiProperty({ type: String, enum: ["owner", "member"] }) role!:
    | "owner"
    | "member";
  @ApiProperty({ type: String, format: "date-time" }) createdAt!: string;
}
