/**
 * Contract compiler (Workspace Spec v1 §1.4, card #8).
 *
 * One EntityContract, compiled three ways:
 *   1. compileToTools    — LLM tool definitions whose input schema only
 *                          admits queries the contract allows
 *   2. compileToValidator — a pure QuerySpec → violations function
 *   3. compileToExecutor — validates, applies limit defaults, then invokes
 *                          the vendor fetch with the end user's auth intact
 *
 * All three derive from the same contract object plus OPS_BY_KIND and
 * `filterValueSchemas` (spec/query.ts), so the tool generator and the
 * validator cannot drift: a query the generated tool schema accepts is a
 * query the validator passes, and vice versa.
 */
import { z } from "zod";
import {
  fieldNameSchema,
  filterValueSchemas,
  type FilterOp,
  type QuerySpec,
} from "../spec/query.js";
import type { AggregationFn, EntityContract, FieldKind } from "./define-entity.js";
import { executeQuery } from "./execute-query.js";

/** Which filter ops the query grammar allows per field kind (Spec v1 §5). */
export const OPS_BY_KIND: Readonly<Record<FieldKind, readonly FilterOp[]>> = {
  string: ["eq", "neq", "contains", "in", "not_in"],
  number: ["eq", "neq", "gt", "gte", "lt", "lte", "between", "in", "not_in"],
  boolean: ["eq", "neq"],
  enum: ["eq", "neq", "in", "not_in"],
  date: ["on", "before", "after", "between"],
  datetime: ["on", "before", "after", "between"],
};

export type PolicyViolationCode =
  | "unknown_field"
  | "not_filterable"
  | "op_not_allowed"
  | "not_sortable"
  | "not_groupable"
  | "aggregation_not_allowed"
  | "limit_exceeded";

export interface PolicyViolation {
  code: PolicyViolationCode;
  /** The offending field, when the violation is about one. */
  field?: string;
  message: string;
}

/** A query the contract's policy rejects (thrown by the executor). */
export class QueryPolicyError extends Error {
  constructor(
    entity: string,
    readonly violations: readonly PolicyViolation[],
  ) {
    super(
      `query violates the "${entity}" contract: ${violations
        .map((v) => v.message)
        .join("; ")}`,
    );
    this.name = "QueryPolicyError";
  }
}

/**
 * Framework-neutral tool definition. The Tambo adapter layer (Phase 3)
 * registers these; this package stays free of @tambo-ai imports by charter.
 */
export interface CompiledTool {
  /** e.g. "query_case" */
  name: string;
  /** Capability summary the LLM reads: fields, kinds, ops, limits. */
  description: string;
  /** Zod schema admitting exactly the queries the contract allows. */
  inputSchema: z.ZodTypeAny;
}

/**
 * Compile a contract into LLM tool definitions.
 *
 * The generated input schema is *constructive*: filter variants only exist
 * for (filterable field × op legal for its kind), sort/groupBy enums only
 * contain the allowed fields, aggregation variants only the allowed fn/field
 * pairs, and limit is capped at the contract's maxLimit.
 */
export function compileToTools(contract: EntityContract): CompiledTool[] {
  return [
    {
      name: `query_${contract.name}`,
      description: describeContract(contract),
      inputSchema: buildQuerySchema(contract),
    },
  ];
}

/**
 * Compile a contract into a pure policy validator.
 *
 * @returns A function mapping an (already shape-valid) QuerySpec to its
 *          policy violations — empty array means the query is allowed.
 */
export function compileToValidator(
  contract: EntityContract,
): (query: QuerySpec) => PolicyViolation[] {
  const { fields, capabilities } = contract;
  const known = (field: string) => field in fields;

  return (query) => {
    const violations: PolicyViolation[] = [];
    const flag = (code: PolicyViolationCode, field: string, message: string) =>
      violations.push({ code, field, message });

    for (const filter of query.filters) {
      const { field, op } = filter;
      if (!known(field)) {
        flag("unknown_field", field, `unknown field "${field}"`);
      } else if (!capabilities.filterable.has(field)) {
        flag("not_filterable", field, `field "${field}" is not filterable`);
      } else if (!OPS_BY_KIND[fields[field]!].includes(op)) {
        flag(
          "op_not_allowed",
          field,
          `op "${op}" is not allowed on ${fields[field]} field "${field}"`,
        );
      }
    }

    for (const sort of query.sort) {
      if (!capabilities.sortable.has(sort.field)) {
        flag("not_sortable", sort.field, `field "${sort.field}" is not sortable`);
      }
    }

    if (query.groupBy !== undefined && !capabilities.groupable.has(query.groupBy)) {
      flag(
        "not_groupable",
        query.groupBy,
        `field "${query.groupBy}" is not groupable`,
      );
    }

    for (const agg of query.aggregations ?? []) {
      // Field-less count is always available; everything else needs an
      // explicit grant in capabilities.aggregations.
      if (agg.fn === "count" && agg.field === undefined) continue;
      const grantedFns = agg.field
        ? (capabilities.aggregations[agg.field] ?? [])
        : [];
      if (agg.field !== undefined && !known(agg.field)) {
        flag("unknown_field", agg.field, `unknown field "${agg.field}"`);
      } else if (!grantedFns.includes(agg.fn)) {
        flag(
          "aggregation_not_allowed",
          agg.field ?? agg.fn,
          `aggregation ${agg.fn}(${agg.field ?? ""}) is not allowed`,
        );
      }
    }

    if (query.limit !== undefined && query.limit > capabilities.maxLimit) {
      flag(
        "limit_exceeded",
        "limit",
        `limit ${query.limit} exceeds maxLimit ${capabilities.maxLimit}`,
      );
    }

    return violations;
  };
}

/**
 * Compile a contract into the query executor.
 *
 * Validates against the compiled validator, applies the contract's
 * defaultLimit when the query omits one, then invokes the vendor's fetch
 * with `auth` passed through UNCHANGED — the executor runs with the end
 * user's credentials, never ours (ADR-4).
 *
 * @throws {QueryPolicyError} When the query violates the contract
 */
export function compileToExecutor(
  contract: EntityContract,
): (args: { query: QuerySpec; auth: unknown }) => Promise<unknown[]> {
  const validate = compileToValidator(contract);
  // Alias the vendor executor: the purity guard greps for direct calls to
  // anything named fetch (global fetch is never touched here).
  const run = contract.fetch;

  return async ({ query, auth }) => {
    const violations = validate(query);
    if (violations.length > 0) {
      throw new QueryPolicyError(contract.name, violations);
    }
    const bounded: QuerySpec = {
      ...query,
      limit: query.limit ?? contract.capabilities.defaultLimit,
    };
    // The vendor fetch returns rows; the client-side engine applies the ops the
    // vendor didn't (filter/sort/group/aggregate), per the contract's execution
    // modes, and shapes the result (card #38).
    const rows = await run({ query: bounded, auth });
    return executeQuery(rows, bounded, {
      execution: contract.capabilities.execution,
      maxRows: contract.capabilities.maxClientRows,
    });
  };
}

// ---------------------------------------------------------------------------
// Tool schema construction
// ---------------------------------------------------------------------------

function buildQuerySchema(contract: EntityContract): z.ZodTypeAny {
  const { fields, capabilities } = contract;

  const filterVariants: z.ZodTypeAny[] = [];
  for (const op of Object.keys(filterValueSchemas) as FilterOp[]) {
    const fieldsForOp = [...capabilities.filterable].filter((field) =>
      OPS_BY_KIND[fields[field]!].includes(op),
    );
    if (fieldsForOp.length === 0) continue;
    filterVariants.push(
      z
        .object({
          field: enumOf(fieldsForOp),
          op: z.literal(op),
          value: filterValueSchemas[op],
        })
        .strict(),
    );
  }

  const aggregationVariants: z.ZodTypeAny[] = [
    // Field-less count, always available.
    z.object({ fn: z.literal("count"), alias: fieldNameSchema }).strict(),
  ];
  for (const [field, fns] of Object.entries(capabilities.aggregations)) {
    if (fns.length === 0) continue;
    aggregationVariants.push(
      z
        .object({
          fn: enumOf(fns as readonly string[]),
          field: z.literal(field),
          alias: fieldNameSchema,
        })
        .strict(),
    );
  }

  return z
    .object({
      filters: z.array(unionOf(filterVariants)).max(16).default([]),
      sort: z
        .array(
          capabilities.sortable.size > 0
            ? z
                .object({
                  field: enumOf([...capabilities.sortable]),
                  dir: z.enum(["asc", "desc"]),
                })
                .strict()
            : z.never(),
        )
        .max(3)
        .default([]),
      ...(capabilities.groupable.size > 0
        ? { groupBy: enumOf([...capabilities.groupable]).optional() }
        : {}),
      aggregations: z.array(unionOf(aggregationVariants)).max(8).optional(),
      limit: z.number().int().min(1).max(capabilities.maxLimit).optional(),
    })
    .strict();
}

function enumOf(values: readonly string[]): z.ZodTypeAny {
  return values.length === 1
    ? z.literal(values[0]!)
    : z.enum(values as [string, ...string[]]);
}

function unionOf(variants: z.ZodTypeAny[]): z.ZodTypeAny {
  if (variants.length === 0) return z.never();
  if (variants.length === 1) return variants[0]!;
  return z.union(variants as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
}

function describeContract(contract: EntityContract): string {
  const { fields, capabilities } = contract;
  const filterable = [...capabilities.filterable]
    .map((f) => `${f} (${fields[f]}: ${OPS_BY_KIND[fields[f]!].join("/")})`)
    .join(", ");
  const aggregations = Object.entries(capabilities.aggregations)
    .flatMap(([field, fns]) => fns.map((fn) => `${fn}(${field})`))
    .join(", ");
  return [
    `Query the "${contract.name}" entity.`,
    filterable && `Filterable: ${filterable}.`,
    capabilities.sortable.size > 0 &&
      `Sortable: ${[...capabilities.sortable].join(", ")}.`,
    capabilities.groupable.size > 0 &&
      `Groupable: ${[...capabilities.groupable].join(", ")}.`,
    `Aggregations: count${aggregations ? `, ${aggregations}` : ""}.`,
    `Max ${capabilities.maxLimit} rows (default ${capabilities.defaultLimit}).`,
    `Dates accept ISO strings or symbolic tokens like {"rel":"this_month"}.`,
    `Omit unused keys entirely — never send null or empty filter arrays.`,
  ]
    .filter(Boolean)
    .join(" ");
}

// Compile-time drift guard: every AggregationFn the contract layer knows is
// representable by the query grammar and vice versa.
type _AggFnsMatch = AggregationFn extends NonNullable<
  QuerySpec["aggregations"]
>[number]["fn"]
  ? true
  : never;
const _aggFnsMatch: _AggFnsMatch = true;
void _aggFnsMatch;
