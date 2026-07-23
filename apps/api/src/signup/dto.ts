/**
 * /v1/signup shapes (#91). The dashboard runs the GitHub OAuth dance
 * server-side (it holds the client secret), verifies the user, and calls this
 * endpoint server-to-server with a provisioning secret — so the request body
 * is a trusted identity, not something a browser supplies directly.
 */
import { ApiProperty } from "@nestjs/swagger";
import { z } from "zod";

export const signupRequestSchema = z
  .object({
    /** Human-facing org name (display only). */
    orgName: z.string().trim().min(1).max(80),
    /** Desired URL handle; format re-checked in the DB layer (source of truth). */
    slug: z.string().trim().min(3).max(40),
    owner: z
      .object({
        /** Provider identity `"<provider>:<id>"`, e.g. `"github:12345"`. */
        externalId: z.string().min(1).max(120),
        email: z.string().email().max(200).nullish(),
        name: z.string().max(120).nullish(),
      })
      .strict(),
  })
  .strict();
export type SignupRequest = z.infer<typeof signupRequestSchema>;

export class SignupResponseDto {
  @ApiProperty({ type: String }) tenantId!: string;
  @ApiProperty({ type: String }) slug!: string;
  @ApiProperty({ type: String }) orgName!: string;
  @ApiProperty({ type: String }) userId!: string;
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      "Raw admin API key — shown exactly once, only on first provision. " +
      "null on an idempotent replay (the key already exists, hash-only).",
  })
  apiKey!: string | null;
  @ApiProperty({
    type: Boolean,
    description: "false = idempotent replay of an already-provisioned identity.",
  })
  created!: boolean;
}
