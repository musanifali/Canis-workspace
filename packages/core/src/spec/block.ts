/**
 * Block model: config vs binding split (Workspace Spec v1 §4).
 *
 * `config` is static presentation — plain JSON literals only, validated in
 * depth against the block type's registry config schema by the validator.
 * `binding` is everything that produces data. The renderer merges
 * `config + query results` into component props.
 */
import { z } from "zod";
import { frameSchema } from "./frame.js";
import { querySpecSchema } from "./query.js";

export const blockIdSchema = z
  .string()
  .regex(/^blk_[a-z0-9]+$/, "expected a block id like blk_a1");
export type BlockId = z.infer<typeof blockIdSchema>;

/** Registry block type name (PascalCase, e.g. "CasesTable"). */
export const blockTypeSchema = z
  .string()
  .regex(/^[A-Z][A-Za-z0-9]*$/, "expected a PascalCase block type name");

/**
 * Config values are plain JSON — never field references, never templates.
 * Null is excluded (A3): optional values are omitted, never null; an
 * explicit null is a spec shape error. Depth validation against the
 * registry's config schema is validator work; here we constrain to
 * JSON-serializable, non-null values.
 */
const jsonLiteralSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(jsonLiteralSchema),
    z.record(jsonLiteralSchema),
  ]),
);

export const bindingSchema = z
  .object({
    entity: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z][a-zA-Z0-9_]*$/, "expected an entity name like case"),
    query: querySpecSchema,
  })
  .strict();
export type Binding = z.infer<typeof bindingSchema>;

export const blockSchema = z
  .object({
    id: blockIdSchema,
    type: blockTypeSchema,
    frame: frameSchema,
    config: z.record(jsonLiteralSchema).default({}),
    /** `null` marks a static block (no data); legal but unused in the v1 registry. */
    binding: bindingSchema.nullable(),
  })
  .strict();
export type Block = z.infer<typeof blockSchema>;
