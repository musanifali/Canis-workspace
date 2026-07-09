/**
 * In-memory query engine (card #38).
 *
 * The adoption thesis: most vendor APIs can't serve arbitrary group-by/aggregate
 * queries, so we don't ask them to. The vendor `fetch` just returns rows (every
 * API can do that) and this pure engine runs filter/sort/group/aggregate
 * client-side, up to a row cap. Operations a vendor CAN run server-side are
 * declared `execution: "server"` per operation and skipped here.
 *
 * Pure and IO-free (no fetch, no clock): dates must already be resolved to
 * absolute values (the React layer does this before calling the executor).
 */
import {
  deriveBindingShape,
  type Aggregation,
  type Filter,
  type QuerySpec,
  type Sort,
} from "../spec/query.js";

export type ExecutionMode = "client" | "server";

/** Which query operations run client-side vs. are done by the vendor API. */
export interface ExecutionModes {
  filter: ExecutionMode;
  sort: ExecutionMode;
  group: ExecutionMode;
  aggregate: ExecutionMode;
}

/** Default: the SDK does everything; the vendor just returns rows. */
export const DEFAULT_EXECUTION: ExecutionModes = {
  filter: "client",
  sort: "client",
  group: "client",
  aggregate: "client",
};

/** Default ceiling on rows the client-side engine will process. */
export const DEFAULT_MAX_CLIENT_ROWS = 10_000;

export interface ExecuteQueryOptions {
  execution?: Partial<ExecutionModes> | undefined;
  /** Cap on input rows processed client-side. Default DEFAULT_MAX_CLIENT_ROWS. */
  maxRows?: number | undefined;
}

/**
 * Thrown when the vendor returns more rows than the client-side engine will
 * process. The message points at the graduation path: narrow the query, raise
 * the cap, or move the operation server-side.
 */
export class RowCapExceededError extends Error {
  constructor(
    readonly rowCount: number,
    readonly cap: number,
  ) {
    super(
      `client-side query received ${rowCount} rows, exceeding the ${cap}-row cap. ` +
        `Narrow the query, raise the entity's maxClientRows, or declare ` +
        `execution:"server" for operations the vendor API can run.`,
    );
    this.name = "RowCapExceededError";
  }
}

type Row = Record<string, unknown>;

/**
 * Execute a (validated, date-resolved) QuerySpec against rows. Returns data
 * shaped per the query's derived binding shape:
 *   - rows      → the filtered/sorted/limited rows
 *   - groups    → `{ group, rows }[]`
 *   - aggregate → `[{ ...aliases }]` (one element), or `{ group, ...aliases }[]`
 *     when grouped
 *
 * @throws {RowCapExceededError} When client-side work would exceed the row cap
 */
export function executeQuery(
  rows: readonly unknown[],
  query: QuerySpec,
  options: ExecuteQueryOptions = {},
): unknown[] {
  const exec = { ...DEFAULT_EXECUTION, ...options.execution };
  const cap = options.maxRows ?? DEFAULT_MAX_CLIENT_ROWS;

  const doesClientWork =
    exec.filter === "client" ||
    exec.sort === "client" ||
    exec.group === "client" ||
    exec.aggregate === "client";
  if (doesClientWork && rows.length > cap) {
    throw new RowCapExceededError(rows.length, cap);
  }

  let working = rows as Row[];
  if (exec.filter === "client" && query.filters.length > 0) {
    working = working.filter((row) => query.filters.every((f) => matchesFilter(row, f)));
  }
  if (exec.sort === "client" && query.sort.length > 0) {
    working = sortRows(working, query.sort);
  }

  const shape = deriveBindingShape(query);
  if (shape === "rows") {
    return working.slice(0, query.limit ?? working.length);
  }

  if (shape === "groups") {
    if (exec.group === "server") return [...working];
    return groupRows(working, query.groupBy as string).map(([group, groupRowsList]) => ({
      group,
      rows: groupRowsList,
    }));
  }

  // aggregate
  if (exec.aggregate === "server") return [...working];
  const aggregations = query.aggregations ?? [];
  if (query.groupBy && exec.group === "client") {
    return groupRows(working, query.groupBy).map(([group, groupRowsList]) => ({
      group,
      ...computeAggregations(groupRowsList, aggregations),
    }));
  }
  return [computeAggregations(working, aggregations)];
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

type DateVal = { abs: string };
const isDateVal = (x: unknown): x is DateVal =>
  typeof x === "object" && x !== null && "abs" in x;
const day = (v: unknown): string => String(v).slice(0, 10);

function matchesFilter(row: Row, filter: Filter): boolean {
  const value = row[filter.field];
  switch (filter.op) {
    case "eq":
      return value === filter.value;
    case "neq":
      return value !== filter.value;
    case "in":
      return (filter.value as unknown[]).includes(value);
    case "not_in":
      return !(filter.value as unknown[]).includes(value);
    case "contains":
      return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
    case "gt":
      return (value as number) > (filter.value as number);
    case "gte":
      return (value as number) >= (filter.value as number);
    case "lt":
      return (value as number) < (filter.value as number);
    case "lte":
      return (value as number) <= (filter.value as number);
    case "on":
      return day(value) === (filter.value as DateVal).abs.slice(0, 10);
    case "before":
      return day(value) < (filter.value as DateVal).abs.slice(0, 10);
    case "after":
      return day(value) > (filter.value as DateVal).abs.slice(0, 10);
    case "between": {
      const [a, b] = filter.value as [unknown, unknown];
      if (isDateVal(a) && isDateVal(b)) {
        const d = day(value);
        return d >= a.abs.slice(0, 10) && d <= b.abs.slice(0, 10);
      }
      return (value as number) >= (a as number) && (value as number) <= (b as number);
    }
    default:
      return true;
  }
}

function sortRows(rows: Row[], sorts: readonly Sort[]): Row[] {
  return [...rows].sort((a, b) => {
    for (const sort of sorts) {
      const l = a[sort.field];
      const r = b[sort.field];
      if (l === r) continue;
      const cmp = (l as never) < (r as never) ? -1 : 1;
      return sort.dir === "desc" ? -cmp : cmp;
    }
    return 0;
  });
}

function groupRows(rows: Row[], field: string): [string, Row[]][] {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const key = String(row[field]);
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }
  return [...groups.entries()];
}

function computeAggregations(rows: Row[], aggregations: readonly Aggregation[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const agg of aggregations) {
    out[agg.alias] = computeAggregation(rows, agg);
  }
  return out;
}

function computeAggregation(rows: Row[], agg: Aggregation): number {
  if (agg.fn === "count") return rows.length;
  const nums = rows
    .map((r) => r[agg.field as string])
    .filter((x): x is number => typeof x === "number");
  if (nums.length === 0) return 0;
  switch (agg.fn) {
    case "sum":
      return nums.reduce((s, n) => s + n, 0);
    case "avg":
      return Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 100) / 100;
    case "min":
      return Math.min(...nums);
    case "max":
      return Math.max(...nums);
    default:
      return 0;
  }
}
