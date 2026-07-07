/**
 * QuerySpec grammar (Workspace Spec v1 §5).
 *
 * Schema-level rules: shapes, operator/value pairings, bounded limits,
 * non-empty `in` arrays. Contract-level rules (is this field filterable,
 * is this op legal for the field's type) belong to the policy validator.
 */
import { z } from "zod";
import { dateValueSchema } from "./time.js";

const fieldNameSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "expected a bare field name");

const scalarSchema = z.union([z.string(), z.number(), z.boolean()]);

/**
 * One filter condition. The op discriminates the value shape:
 * - eq/neq/contains → scalar
 * - gt/gte/lt/lte → number or date value
 * - in/not_in → non-empty scalar array (empty array is a spec error — the
 *   LLM tool layer strips empty filters before spec assembly, §5)
 * - between → inclusive [start, end] pair
 * - on/before/after → date value (absolute or symbolic)
 */
export const filterSchema = z.discriminatedUnion("op", [
  z
    .object({ field: fieldNameSchema, op: z.literal("eq"), value: scalarSchema })
    .strict(),
  z
    .object({ field: fieldNameSchema, op: z.literal("neq"), value: scalarSchema })
    .strict(),
  z
    .object({
      field: fieldNameSchema,
      op: z.literal("contains"),
      value: z.string().min(1),
    })
    .strict(),
  z
    .object({
      field: fieldNameSchema,
      op: z.literal("in"),
      value: z.array(scalarSchema).nonempty(),
    })
    .strict(),
  z
    .object({
      field: fieldNameSchema,
      op: z.literal("not_in"),
      value: z.array(scalarSchema).nonempty(),
    })
    .strict(),
  z
    .object({ field: fieldNameSchema, op: z.literal("gt"), value: z.number() })
    .strict(),
  z
    .object({ field: fieldNameSchema, op: z.literal("gte"), value: z.number() })
    .strict(),
  z
    .object({ field: fieldNameSchema, op: z.literal("lt"), value: z.number() })
    .strict(),
  z
    .object({ field: fieldNameSchema, op: z.literal("lte"), value: z.number() })
    .strict(),
  z
    .object({
      field: fieldNameSchema,
      op: z.literal("between"),
      value: z.union([
        z.tuple([z.number(), z.number()]),
        z.tuple([dateValueSchema, dateValueSchema]),
        // whole-period symbolic ranges: { rel: "this_month" }
        dateValueSchema,
      ]),
    })
    .strict(),
  z
    .object({ field: fieldNameSchema, op: z.literal("on"), value: dateValueSchema })
    .strict(),
  z
    .object({
      field: fieldNameSchema,
      op: z.literal("before"),
      value: dateValueSchema,
    })
    .strict(),
  z
    .object({
      field: fieldNameSchema,
      op: z.literal("after"),
      value: dateValueSchema,
    })
    .strict(),
]);
export type Filter = z.infer<typeof filterSchema>;

export const sortSchema = z
  .object({
    field: fieldNameSchema,
    dir: z.enum(["asc", "desc"]),
  })
  .strict();
export type Sort = z.infer<typeof sortSchema>;

export const aggregationSchema = z
  .object({
    fn: z.enum(["count", "sum", "avg", "min", "max"]),
    field: fieldNameSchema.optional(),
    alias: fieldNameSchema,
  })
  .strict()
  .refine((agg) => agg.fn === "count" || agg.field !== undefined, {
    message: "every aggregation except count requires a field",
  });
export type Aggregation = z.infer<typeof aggregationSchema>;

export const querySpecSchema = z
  .object({
    filters: z.array(filterSchema).max(16).default([]),
    sort: z.array(sortSchema).max(3).default([]),
    groupBy: fieldNameSchema.optional(),
    aggregations: z.array(aggregationSchema).max(8).optional(),
    // Upper bound is contract-specific; schema enforces sane absolute bounds
    // (Phase 0 lesson: unbounded limit silently corrupted results)
    limit: z.number().int().min(1).max(1000).optional(),
  })
  .strict();
export type QuerySpec = z.infer<typeof querySpecSchema>;
