/**
 * Spec-assertion DSL for the generation eval (card #22).
 *
 * Expectations are STRUCTURAL, never string matching: a prompt asserts which
 * block types must appear and what some block's binding query must contain
 * (entity, filters, groupBy, aggregations, sort). This survives the model's
 * legitimate variation — "grouped by analyst" is satisfied by a GroupedBoard
 * whose query groups by `analyst`, regardless of the surrounding prose or which
 * exact filters it also added — while still failing a spec that doesn't answer
 * the request.
 */
import type { WorkspaceSpec } from "@workspace-engine/core";

export interface FilterExpectation {
  field: string;
  op?: string;
  /** When given, the filter's value must deep-equal this (arrays order-insensitive). */
  value?: unknown;
}

export interface QueryExpectation {
  /** Entity some block must bind. */
  binds?: string;
  filters?: FilterExpectation[];
  groupBy?: string;
  aggregates?: { fn: string; field?: string }[];
  sorts?: { field: string; dir?: "asc" | "desc" }[];
}

export interface Expectation {
  /** Block types that must each appear at least once. */
  blockTypes?: string[];
  /** Some single block's binding.query must satisfy all of this. */
  query?: QueryExpectation;
}

export interface AssertResult {
  pass: boolean;
  failures: string[];
}

type Block = WorkspaceSpec["blocks"][number];

export function assertSpec(spec: WorkspaceSpec, exp: Expectation): AssertResult {
  const failures: string[] = [];

  for (const type of exp.blockTypes ?? []) {
    if (!spec.blocks.some((b) => b.type === type)) {
      const found = spec.blocks.map((b) => b.type).join(", ") || "none";
      failures.push(`expected a ${type} block; found: ${found}`);
    }
  }

  if (exp.query) {
    // The whole query expectation must be satisfied by ONE block (not spread
    // across several), so a request's data intent lands on a single binding.
    const perBlock = spec.blocks.map((b) => queryFailures(b, exp.query!));
    if (!perBlock.some((f) => f.length === 0)) {
      const closest = perBlock
        .filter((f) => f.length > 0)
        .sort((a, b) => a.length - b.length)[0] ?? ["no block has a binding query"];
      failures.push(`no block's query matches: ${closest.join("; ")}`);
    }
  }

  return { pass: failures.length === 0, failures };
}

function queryFailures(block: Block, exp: QueryExpectation): string[] {
  const fails: string[] = [];
  const binding = block.binding;
  const query = binding?.query;

  if (exp.binds && binding?.entity !== exp.binds) {
    fails.push(`binds "${binding?.entity ?? "none"}" ≠ "${exp.binds}"`);
  }
  for (const f of exp.filters ?? []) {
    const ok = (query?.filters ?? []).some(
      (qf) =>
        qf.field === f.field &&
        (f.op === undefined || qf.op === f.op) &&
        (f.value === undefined || looseEqual(qf.value, f.value)),
    );
    if (!ok) fails.push(`missing filter on "${f.field}"${f.op ? ` (${f.op})` : ""}`);
  }
  if (exp.groupBy && query?.groupBy !== exp.groupBy) {
    fails.push(`groupBy "${query?.groupBy ?? "none"}" ≠ "${exp.groupBy}"`);
  }
  for (const a of exp.aggregates ?? []) {
    const ok = (query?.aggregations ?? []).some(
      (qa) => qa.fn === a.fn && (a.field === undefined || qa.field === a.field),
    );
    if (!ok) fails.push(`missing aggregation ${a.fn}(${a.field ?? ""})`);
  }
  for (const s of exp.sorts ?? []) {
    const ok = (query?.sort ?? []).some(
      (qs) => qs.field === s.field && (s.dir === undefined || qs.dir === s.dir),
    );
    if (!ok) fails.push(`missing sort on "${s.field}"`);
  }
  return fails;
}

/** Deep equality; arrays of scalars compared as sets (order-insensitive). */
function looseEqual(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    const rest = [...b];
    return a.every((x) => {
      const i = rest.findIndex((y) => looseEqual(x, y));
      if (i === -1) return false;
      rest.splice(i, 1);
      return true;
    });
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ak = Object.keys(a as object);
    const bk = Object.keys(b as object);
    return (
      ak.length === bk.length &&
      ak.every((k) =>
        looseEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
      )
    );
  }
  return a === b;
}
