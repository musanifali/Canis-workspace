/**
 * Serialize / revive an EntityContract's DECLARATIVE surface (card #87).
 *
 * A tenant's data contract is stored in `data_contracts.definition`
 * (packages/db) as JSON — the fields + capabilities the policy validator gates
 * against — because the vendor's `fetch` executor (ADR-4: vendor code and
 * customer data stay on the vendor's side) neither can nor should live in our
 * database. `serializeContract` extracts that JSON-safe surface from a real
 * `defineEntity` contract; `reviveContract` rebuilds the `EntityContract` the
 * pure `validateSpec` / contract compiler consume — so the Workspace Service
 * can re-gate a submitted spec with the SAME authority the render path uses,
 * with no forked validation logic.
 *
 * A revived contract is VALIDATION-ONLY. The validator reads a contract's
 * resolved `fields` (field → kind) and `capabilities`; it never reads the Zod
 * `schema` or calls `fetch`. So revival restores exactly those and installs a
 * placeholder schema plus a `fetch` that throws: a revived contract can gate a
 * spec but must never execute a query. Execution stays with the vendor's own
 * `defineEntity` contract, on their side.
 */
import { z } from "zod";
import type {
  AggregationFn,
  EntityContract,
  FieldKind,
} from "./define-entity.js";
import type { ExecutionModes } from "./execute-query.js";

/**
 * The JSON-serializable declarative surface of a contract: everything the
 * policy validator and contract compiler need, and nothing that cannot cross
 * a `jsonb` column (no Zod schema, no executor).
 */
export interface SerializedEntityContract {
  name: string;
  /** Every field resolved to its query-grammar kind. */
  fields: Record<string, FieldKind>;
  capabilities: {
    filterable: readonly string[];
    sortable: readonly string[];
    groupable: readonly string[];
    aggregations: Record<string, readonly AggregationFn[]>;
    defaultLimit: number;
    maxLimit: number;
    execution: ExecutionModes;
    maxClientRows: number;
  };
}

const fieldKindSchema = z.enum([
  "string",
  "number",
  "boolean",
  "enum",
  "date",
  "datetime",
]);
const aggregationFnSchema = z.enum(["count", "sum", "avg", "min", "max"]);
const executionModeSchema = z.enum(["client", "server"]);

const serializedContractSchema = z
  .object({
    name: z.string().min(1),
    fields: z.record(fieldKindSchema),
    capabilities: z
      .object({
        filterable: z.array(z.string()),
        sortable: z.array(z.string()),
        groupable: z.array(z.string()),
        aggregations: z.record(z.array(aggregationFnSchema)),
        defaultLimit: z.number().int(),
        maxLimit: z.number().int(),
        execution: z
          .object({
            filter: executionModeSchema,
            sort: executionModeSchema,
            group: executionModeSchema,
            aggregate: executionModeSchema,
          })
          .strict(),
        maxClientRows: z.number().int(),
      })
      .strict(),
  })
  .strict();

/** Thrown when a stored contract definition cannot be revived. */
export class ContractRevivalError extends Error {
  constructor(message: string) {
    super(`cannot revive contract: ${message}`);
    this.name = "ContractRevivalError";
  }
}

/**
 * Extract the JSON-safe declarative surface of a contract for storage.
 * @returns The serialized contract (safe to persist as jsonb).
 */
export function serializeContract(
  contract: EntityContract,
): SerializedEntityContract {
  const { capabilities } = contract;
  return {
    name: contract.name,
    fields: { ...contract.fields },
    capabilities: {
      filterable: [...capabilities.filterable],
      sortable: [...capabilities.sortable],
      groupable: [...capabilities.groupable],
      aggregations: Object.fromEntries(
        Object.entries(capabilities.aggregations).map(([field, fns]) => [
          field,
          [...fns],
        ]),
      ),
      defaultLimit: capabilities.defaultLimit,
      maxLimit: capabilities.maxLimit,
      execution: { ...capabilities.execution },
      maxClientRows: capabilities.maxClientRows,
    },
  };
}

/**
 * Rebuild a validation-only `EntityContract` from a stored definition.
 *
 * The result is safe to hand to `validateSpec` / the contract compiler: its
 * `fields` and `capabilities` are faithfully restored. Its `schema` is a
 * placeholder (the validator never reads it) and its `fetch` throws — a
 * revived contract gates specs, it never runs queries.
 *
 * @param serialized The stored `data_contracts.definition` value.
 * @returns The revived contract.
 * @throws {ContractRevivalError} When the stored definition is malformed.
 */
export function reviveContract(serialized: unknown): EntityContract {
  const parsed = serializedContractSchema.safeParse(serialized);
  if (!parsed.success) {
    throw new ContractRevivalError(parsed.error.message);
  }
  const { name, fields, capabilities } = parsed.data;

  return {
    name,
    // Validation-only: the validator reads resolved `fields`/`capabilities`,
    // never `schema`. We expose an empty object schema so the type is
    // satisfied without reconstructing (unavailable) per-field Zod types.
    schema: z.object({}) as unknown as EntityContract["schema"],
    fields: { ...fields },
    capabilities: {
      filterable: new Set(capabilities.filterable),
      sortable: new Set(capabilities.sortable),
      groupable: new Set(capabilities.groupable),
      aggregations: { ...capabilities.aggregations },
      defaultLimit: capabilities.defaultLimit,
      maxLimit: capabilities.maxLimit,
      execution: { ...capabilities.execution },
      maxClientRows: capabilities.maxClientRows,
    },
    fetch: () => {
      throw new ContractRevivalError(
        `"${name}" was revived for validation only and has no executor`,
      );
    },
  };
}
