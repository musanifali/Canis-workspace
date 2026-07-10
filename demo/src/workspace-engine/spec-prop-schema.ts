/**
 * Tambo-safe WorkspaceSpec schema for component props / tool input (review P1 #70).
 *
 * Core's `workspaceSpecSchema` types a block's `config` as `z.record(...)`, and
 * Tambo rejects dynamic-key records in a component propsSchema (its streaming
 * prop-diff needs explicit keys). But a permissive `z.any()` prop removes the
 * only thing that makes DeepSeek emit a *valid* spec ~reliably: a schema to
 * generate against (prose grounding alone left first-attempt validity ~40%).
 *
 * So this mirrors the spec shape with EXPLICIT keys throughout — the union of
 * every block type's config keys (all optional), and the query grammar spelled
 * out — giving the model a real schema to match. It is intentionally looser than
 * the contract (any field name, any op string): `validateSpec` remains the deep
 * authority on which fields/ops a given entity actually allows. This schema's job
 * is *shape* reliability; the gate's job is *contract* correctness.
 */
import { z } from "zod";

const dateToken = z.union([
  z.object({ rel: z.string() }),
  z.object({ abs: z.string() }),
]);

const filterValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.union([z.string(), z.number()])), // in / not_in
  dateToken, // on / before / after / between-as-whole-period
]);

const filter = z.object({
  field: z.string(),
  op: z.string(),
  value: filterValue,
});

const sort = z.object({ field: z.string(), dir: z.enum(["asc", "desc"]) });

const aggregation = z.object({
  fn: z.enum(["count", "sum", "avg", "min", "max"]),
  field: z.string().optional(),
  alias: z.string(),
});

const query = z.object({
  filters: z.array(filter),
  sort: z.array(sort).optional(),
  groupBy: z.string().optional(),
  aggregations: z.array(aggregation).optional(),
});

const kpiCard = z.object({
  alias: z.string(),
  label: z.string(),
  intent: z.enum(["positive", "negative", "neutral"]).optional(),
});

// The union of every default block's config keys — all optional, explicit keys.
const config = z.object({
  title: z.string().optional(),
  columns: z.array(z.string()).optional(),
  emptyMessage: z.string().optional(),
  cards: z.array(kpiCard).optional(),
  targets: z.array(z.string()).optional(),
  fields: z.array(z.string()).optional(),
  kind: z.enum(["bar", "line"]).optional(),
});

const binding = z.object({ entity: z.string(), query });

const block = z.object({
  id: z.string(),
  type: z.enum([
    "CasesTable",
    "KpiCards",
    "CaseQueue",
    "FilterBar",
    "GroupedBoard",
    "Graph",
  ]),
  frame: z.object({
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
  }),
  config,
  binding: binding.nullable(),
});

/** The spec as a Tambo-friendly, explicit-key schema (no dynamic records). */
export const specPropSchema = z.object({
  specVersion: z.literal(1),
  title: z.string(),
  blocks: z.array(block),
});
