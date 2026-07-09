/**
 * defineEntity — the vendor-facing data contract (Workspace Spec v1 §1.4).
 *
 * A contract is the single source of truth that later compiles three ways
 * (LLM tools, policy validator, query executor). Field names in capability
 * lists are inferred as literal types from the entity's Zod object schema:
 * `filterable: ["riks"]` is a compile error, not a runtime surprise.
 *
 * No codegen: everything is TypeScript inference over the schema you already
 * wrote. The `fetch` function is vendor-supplied and merely *stored* here —
 * this package never performs IO.
 */
import { z } from "zod";
import type { QuerySpec } from "../spec/query.js";
import {
  DEFAULT_EXECUTION,
  DEFAULT_MAX_CLIENT_ROWS,
  type ExecutionModes,
} from "./execute-query.js";

/** Field kinds the query grammar distinguishes (Spec v1 §5). */
export type FieldKind =
  | "string"
  | "number"
  | "boolean"
  | "enum"
  | "date"
  | "datetime";

/** Aggregation functions; numeric fns are only legal on number fields. */
export type AggregationFn = "count" | "sum" | "avg" | "min" | "max";

type FieldNames<Shape extends z.ZodRawShape> = Extract<keyof Shape, string>;

export interface EntityCapabilities<Shape extends z.ZodRawShape> {
  /** Fields the LLM may filter on. */
  filterable: readonly FieldNames<Shape>[];
  /** Fields the LLM may sort by. */
  sortable?: readonly FieldNames<Shape>[];
  /** Fields the LLM may group by. */
  groupable?: readonly FieldNames<Shape>[];
  /** Per-field aggregation functions (count is always available, field-less). */
  aggregations?: Partial<Record<FieldNames<Shape>, readonly AggregationFn[]>>;
  /** Default row limit when a query omits one. */
  defaultLimit?: number;
  /** Hard row-limit ceiling for this entity. */
  maxLimit?: number;
  /**
   * Which query operations the vendor runs server-side vs. the SDK runs
   * client-side over the returned rows (card #38). Default: all "client" — the
   * vendor `fetch` just returns rows and we do filter/sort/group/aggregate.
   */
  execution?: Partial<ExecutionModes>;
  /** Row cap for client-side execution (default 10 000). */
  maxClientRows?: number;
}

export interface DefineEntityArgs<Shape extends z.ZodRawShape> {
  /** Entity name as referenced by spec bindings, e.g. "case". */
  name: string;
  /** The entity's Zod object schema — the source of field names and kinds. */
  schema: z.ZodObject<Shape>;
  /**
   * Kind overrides for fields whose Zod type under-specifies them —
   * primarily ISO-date strings that should be treated as date/datetime.
   */
  fieldKinds?: Partial<Record<FieldNames<Shape>, FieldKind>>;
  capabilities: EntityCapabilities<Shape>;
  /**
   * Vendor-supplied executor. Runs with the END USER's auth context —
   * customer data never rests with us (ADR-4). Stored, never called here.
   */
  fetch: (args: { query: QuerySpec; auth: unknown }) => Promise<unknown[]>;
}

export interface EntityContract<Shape extends z.ZodRawShape = z.ZodRawShape> {
  readonly name: string;
  readonly schema: z.ZodObject<Shape>;
  /** Every schema field resolved to its query-grammar kind. */
  readonly fields: Readonly<Record<string, FieldKind>>;
  readonly capabilities: {
    readonly filterable: ReadonlySet<string>;
    readonly sortable: ReadonlySet<string>;
    readonly groupable: ReadonlySet<string>;
    readonly aggregations: Readonly<Record<string, readonly AggregationFn[]>>;
    readonly defaultLimit: number;
    readonly maxLimit: number;
    readonly execution: ExecutionModes;
    readonly maxClientRows: number;
  };
  readonly fetch: (args: {
    query: QuerySpec;
    auth: unknown;
  }) => Promise<unknown[]>;
}

export class ContractDefinitionError extends Error {
  constructor(entity: string, message: string) {
    super(`invalid contract "${entity}": ${message}`);
    this.name = "ContractDefinitionError";
  }
}

const DEFAULT_LIMIT = 50;
const DEFAULT_MAX_LIMIT = 500;
const NUMERIC_FNS: readonly AggregationFn[] = ["sum", "avg", "min", "max"];

/**
 * Build an entity contract with literal-typed capability fields.
 *
 * @returns The resolved contract: field kinds derived from the schema
 *          (plus overrides), capability sets, and the stored fetch executor
 * @throws {ContractDefinitionError} On unknown fields, kind-incompatible
 *         aggregations, or inconsistent limits
 */
export function defineEntity<Shape extends z.ZodRawShape>(
  args: DefineEntityArgs<Shape>,
): EntityContract<Shape> {
  const { name, schema, capabilities } = args;
  const fields = deriveFieldKinds(schema, args.fieldKinds ?? {});
  const known = new Set(Object.keys(fields));

  const checkFields = (list: readonly string[], capability: string) => {
    for (const field of list) {
      if (!known.has(field)) {
        throw new ContractDefinitionError(
          name,
          `${capability} references unknown field "${field}" (known: ${[...known].join(", ")})`,
        );
      }
    }
  };
  checkFields(capabilities.filterable, "filterable");
  checkFields(capabilities.sortable ?? [], "sortable");
  checkFields(capabilities.groupable ?? [], "groupable");

  const aggregations: Record<string, readonly AggregationFn[]> = {};
  for (const [field, fns] of Object.entries(capabilities.aggregations ?? {})) {
    if (!known.has(field)) {
      throw new ContractDefinitionError(
        name,
        `aggregations references unknown field "${field}"`,
      );
    }
    const kind = fields[field];
    for (const fn of fns ?? []) {
      if (NUMERIC_FNS.includes(fn) && kind !== "number") {
        throw new ContractDefinitionError(
          name,
          `aggregation ${fn}(${field}) requires a number field, got ${kind}`,
        );
      }
    }
    aggregations[field] = [...(fns ?? [])];
  }

  const defaultLimit = capabilities.defaultLimit ?? DEFAULT_LIMIT;
  const maxLimit = capabilities.maxLimit ?? DEFAULT_MAX_LIMIT;
  if (
    !Number.isInteger(defaultLimit) ||
    !Number.isInteger(maxLimit) ||
    defaultLimit < 1 ||
    maxLimit < defaultLimit
  ) {
    throw new ContractDefinitionError(
      name,
      `limits must be integers with 1 <= defaultLimit (${defaultLimit}) <= maxLimit (${maxLimit})`,
    );
  }

  const maxClientRows = capabilities.maxClientRows ?? DEFAULT_MAX_CLIENT_ROWS;
  if (!Number.isInteger(maxClientRows) || maxClientRows < 1) {
    throw new ContractDefinitionError(
      name,
      `maxClientRows must be a positive integer, got ${maxClientRows}`,
    );
  }

  return {
    name,
    schema,
    fields,
    capabilities: {
      filterable: new Set(capabilities.filterable),
      sortable: new Set(capabilities.sortable ?? []),
      groupable: new Set(capabilities.groupable ?? []),
      aggregations,
      defaultLimit,
      maxLimit,
      execution: { ...DEFAULT_EXECUTION, ...(capabilities.execution ?? {}) },
      maxClientRows,
    },
    fetch: args.fetch,
  };
}

function deriveFieldKinds<Shape extends z.ZodRawShape>(
  schema: z.ZodObject<Shape>,
  overrides: Partial<Record<string, FieldKind>>,
): Record<string, FieldKind> {
  const kinds: Record<string, FieldKind> = {};
  for (const [field, type] of Object.entries(schema.shape)) {
    const override = overrides[field];
    kinds[field] = override ?? deriveKind(unwrap(type as z.ZodTypeAny));
  }
  return kinds;
}

/**
 * Zod's stable internal type tag. We detect field types by `_def.typeName`
 * rather than `instanceof z.ZodX` because a vendor almost always builds their
 * entity schema with THEIR copy of zod, not ours — and `instanceof` compares
 * class identity across copies, so it silently fails. The typeName string is
 * identical across every zod 3.x install.
 */
function typeName(type: z.ZodTypeAny): string | undefined {
  const def = (type as { _def?: { typeName?: string } })._def;
  return def?.typeName;
}

function unwrap(type: z.ZodTypeAny): z.ZodTypeAny {
  let current = type;
  for (;;) {
    const def = (current as { _def?: { innerType?: z.ZodTypeAny; schema?: z.ZodTypeAny } })._def;
    switch (typeName(current)) {
      case "ZodOptional":
      case "ZodNullable":
      case "ZodDefault":
        if (!def?.innerType) return current;
        current = def.innerType;
        break;
      case "ZodEffects":
        if (!def?.schema) return current;
        current = def.schema;
        break;
      default:
        return current;
    }
  }
}

function deriveKind(type: z.ZodTypeAny): FieldKind {
  switch (typeName(type)) {
    case "ZodEnum":
    case "ZodNativeEnum":
      return "enum";
    case "ZodNumber":
      return "number";
    case "ZodBoolean":
      return "boolean";
    case "ZodString":
      return "string";
    default:
      throw new ContractDefinitionError(
        "(schema)",
        `unsupported field type ${type.constructor.name} — v1 contracts support string/number/boolean/enum (mark dates via fieldKinds)`,
      );
  }
}
