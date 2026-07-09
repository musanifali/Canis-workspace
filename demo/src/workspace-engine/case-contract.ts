/**
 * Workspace Engine demo kit — the `case` data contract.
 *
 * Wires the demo's seeded compliance dataset (src/services/case-management.ts)
 * to @workspace-engine/core via defineEntity, plus a small executor that runs a
 * validated QuerySpec against the in-memory cases. The generic client-side query
 * engine is card #38; this is deliberately minimal demo glue — enough to make
 * hand-written specs render live (card #18) with zero LLM involvement.
 */
import { defineEntity, deriveBindingShape, type QuerySpec } from "@workspace-engine/core";
import { caseSchema, searchCases, type Case } from "@/services/case-management";

/** Every seeded case, loaded once for the demo executor (240 = dataset size cap). */
const ALL_CASES: Case[] = searchCases({ limit: 240 }).cases;

type DateVal = { abs: string };
const isDateVal = (x: unknown): x is DateVal =>
  typeof x === "object" && x !== null && "abs" in x;
const day = (v: unknown): string => String(v).slice(0, 10);

function matches(c: Case, filter: QuerySpec["filters"][number]): boolean {
  const value = c[filter.field as keyof Case];
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

type Agg = NonNullable<QuerySpec["aggregations"]>[number];

function computeAgg(rows: Case[], agg: Agg): number {
  if (agg.fn === "count") return rows.length;
  const nums = rows
    .map((r) => r[agg.field as keyof Case])
    .filter((x): x is number => typeof x === "number");
  if (nums.length === 0) return 0;
  switch (agg.fn) {
    case "sum":
      return nums.reduce((s, n) => s + n, 0);
    case "avg":
      return Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10;
    case "min":
      return Math.min(...nums);
    case "max":
      return Math.max(...nums);
    default:
      return 0;
  }
}

function computeAggs(rows: Case[], aggs: readonly Agg[]): Record<string, number> {
  return Object.fromEntries(aggs.map((a) => [a.alias, computeAgg(rows, a)]));
}

function groupRows(rows: Case[], field: string): [string, Case[]][] {
  const groups = new Map<string, Case[]>();
  for (const c of rows) {
    const key = String(c[field as keyof Case]);
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }
  return [...groups.entries()];
}

/**
 * Execute a validated QuerySpec against the seeded cases. Return shape follows
 * the spec's derived binding shape (rows / groups / aggregate). Always returns
 * an array (the contract's fetch signature); an aggregate with no groupBy is a
 * single-element array.
 */
async function caseFetch({ query }: { query: QuerySpec; auth: unknown }): Promise<unknown[]> {
  let rows = ALL_CASES.filter((c) => query.filters.every((f) => matches(c, f)));

  const sort = query.sort[0];
  if (sort) {
    const dir = sort.dir === "desc" ? -1 : 1;
    rows = [...rows].sort((a, b) => {
      const l = a[sort.field as keyof Case];
      const r = b[sort.field as keyof Case];
      return (l < r ? -1 : l > r ? 1 : 0) * dir;
    });
  }

  const shape = deriveBindingShape(query);
  if (shape === "rows") {
    return rows.slice(0, query.limit ?? 50);
  }
  if (shape === "groups") {
    return groupRows(rows, query.groupBy as string).map(([group, groupRowsList]) => ({
      group,
      rows: groupRowsList,
    }));
  }
  // aggregate
  const aggs = query.aggregations ?? [];
  if (query.groupBy) {
    return groupRows(rows, query.groupBy).map(([group, groupRowsList]) => ({
      group,
      ...computeAggs(groupRowsList, aggs),
    }));
  }
  return [computeAggs(rows, aggs)];
}

/** The `case` contract: field kinds, capabilities, and the demo executor. */
export const caseContract = defineEntity({
  name: "case",
  schema: caseSchema,
  fieldKinds: { openedDate: "date", dueDate: "date" },
  capabilities: {
    filterable: ["risk", "status", "category", "analyst", "riskScore", "amountUsd", "dueDate", "title", "customer"],
    sortable: ["riskScore", "amountUsd", "dueDate", "openedDate"],
    groupable: ["risk", "status", "category", "analyst"],
    aggregations: {
      riskScore: ["avg", "max"],
      amountUsd: ["sum", "avg"],
    },
    defaultLimit: 50,
    maxLimit: 200,
  },
  fetch: caseFetch,
});
