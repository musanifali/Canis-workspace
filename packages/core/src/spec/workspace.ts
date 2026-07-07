/**
 * Top-level WorkspaceSpec (Workspace Spec v1 §2, §8, §9).
 *
 * Strict shapes throughout: unknown keys are a parse failure, mirroring the
 * validator's SpecShapeError verdict. Cross-block rules (frame overlap,
 * contract conformance) are the policy validator's job, not the schema's.
 */
import { z } from "zod";
import { blockSchema } from "./block.js";
import { timezoneSchema } from "./time.js";

export const SPEC_VERSION = 1;

export const refreshPolicySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("manual") }).strict(),
  z
    .object({
      mode: z.literal("interval"),
      seconds: z.number().int().min(60).max(3600),
    })
    .strict(),
]);
export type RefreshPolicy = z.infer<typeof refreshPolicySchema>;

export const layoutSchema = z
  .object({
    columns: z.literal(12),
  })
  .strict();

export const workspaceSpecSchema = z
  .object({
    specVersion: z.literal(SPEC_VERSION),
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    timezone: timezoneSchema.default("viewer"),
    refresh: refreshPolicySchema.default({ mode: "manual" }),
    layout: layoutSchema.default({ columns: 12 }),
    blocks: z
      .array(blockSchema)
      .min(1)
      .max(24)
      .refine(
        (blocks) => new Set(blocks.map((b) => b.id)).size === blocks.length,
        { message: "block ids must be unique within the spec" },
      ),
  })
  .strict();
export type WorkspaceSpec = z.infer<typeof workspaceSpecSchema>;
