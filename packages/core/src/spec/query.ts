/**
 * QuerySpec grammar (Workspace Spec v1 §5).
 *
 * Schema-level rules: shapes, operator/value pairings, bounded limits,
 * non-empty `in` arrays. Contract-level rules (is this field filterable,
 * is this op legal for the field's type) belong to the policy validator.
 */
import { z } from "zod";
import { dateValueSchema } from "./time.js";

export const fieldNameSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "expected a bare field name");

const scalarSchema = z.union([z.string(), z.number(), z.boolean()]);

/**
 * The op → value-shape table. filterSchema below and the contract compiler's
 * generated tool schemas both consume THIS map, so grammar and generated
 * tools cannot drift (card #8 requirement).
 */
export const filterValueSchemas = {
  eq: scalarSchema,
  neq: scalarSchema,
  contains: z.string().min(1),
  in: z.array(scalarSchema).nonempty(),
  not_in: z.array(scalarSchema).nonempty(),
  gt: z.number(),
  gte: z.number(),
  lt: z.number(),
  lte: z.number(),
  between: z.union([
    z.tuple([z.number(), z.number()]),
    z.tuple([dateValueSchema, dateValueSchema]),
    // whole-period symbolic ranges: { rel: "this_month" }
    dateValueSchema,
  ]),
  on: dateValueSchema,
  before: dateValueSchema,
  after: dateValueSchema,
} as const;
export type FilterOp = keyof typeof filterValueSchemas;

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
    .object({
      field: fieldNameSchema,
      op: z.literal("eq"),
      value: filterValueSchemas.eq,
    })
    .strict(),
  z
    .object({
      field: fieldNameSchema,
      op: z.literal("neq"),
      value: filterValueSchemas.neq,
    })
    .strict(),
  z
    .object({
      field: fieldNameSchema,
      op: z.literal("contains"),
      value: filterValueSchemas.contains,
    })
    .strict(),
  z
    .object({
      field: fieldNameSchema,
      op: z.literal("in"),
      value: filterValueSchemas.in,
    })
    .strict(),
  z
    .object({
      field: fieldNameSchema,
      op: z.literal("not_in"),
      value: filterValueSchemas.not_in,
    })
    .strict(),
  z
    .object({
      field: fieldNameSchema,
      op: z.literal("gt"),
      value: filterValueSchemas.gt,
    })
    .strict(),
  z
    .object({
      field: fieldNameSchema,
      op: z.literal("gte"),
      value: filterValueSchemas.gte,
    })
    .strict(),
  z
    .object({
      field: fieldNameSchema,
      op: z.literal("lt"),
      value: filterValueSchemas.lt,
    })
    .strict(),
  z
    .object({
      field: fieldNameSchema,
      op: z.literal("lte"),
      value: filterValueSchemas.lte,
    })
    .strict(),
  z
    .object({
      field: fieldNameSchema,
      op: z.literal("between"),
      value: filterValueSchemas.between,
    })
    .strict(),
  z
    .object({
      field: fieldNameSchema,
      op: z.literal("on"),
      value: filterValueSchemas.on,
    })
    .strict(),
  z
    .object({
      field: fieldNameSchema,
      op: z.literal("before"),
      value: filterValueSchemas.before,
    })
    .strict(),
  z
    .object({
      field: fieldNameSchema,
      op: z.literal("after"),
      value: filterValueSchemas.after,
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

/**
 * A query's output shape, derived — never declared (Spec v1 §5 A2).
 * `groups` sorts apply within each group; groupBy + aggregations yields
 * one aggregate row per group.
 */
export type BindingShape = "rows" | "groups" | "aggregate";

/**
 * Derive the output shape of a query per the A2 table.
 *
 * @returns "rows" (no groupBy, no aggregations), "groups" (groupBy only),
 *          or "aggregate" (aggregations with or without groupBy)
 */
export function deriveBindingShape(query: {
  groupBy?: string | undefined;
  aggregations?: readonly unknown[] | undefined;
}): BindingShape {
  const hasAggregations = (query.aggregations?.length ?? 0) > 0;
  if (hasAggregations) return "aggregate";
  if (query.groupBy !== undefined) return "groups";
  return "rows";
}

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
