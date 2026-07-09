import { describe, expect, it } from "vitest";
import { z } from "zod";
import { querySpecSchema, type QuerySpec } from "../spec/query.js";
import { defineEntity } from "./define-entity.js";
import { compileToExecutor } from "./compile.js";
import {
  DEFAULT_MAX_CLIENT_ROWS,
  executeQuery,
  RowCapExceededError,
} from "./execute-query.js";

/** Parse a partial query through the real schema (fills filters/sort defaults). */
function q(partial: Partial<QuerySpec>): QuerySpec {
  return querySpecSchema.parse(partial);
}

const ROWS = [
  { id: "a", risk: "high", score: 90, due: "2026-07-10" },
  { id: "b", risk: "low", score: 20, due: "2026-07-25" },
  { id: "c", risk: "high", score: 70, due: "2026-08-01" },
  { id: "d", risk: "medium", score: 50, due: "2026-06-15" },
];

describe("executeQuery — rows", () => {
  it("filters by eq/in and limits", () => {
    const out = executeQuery(ROWS, q({ filters: [{ field: "risk", op: "in", value: ["high"] }], limit: 10 }));
    expect(out.map((r) => (r as { id: string }).id)).toEqual(["a", "c"]);
  });

  it("filters numbers by gte and sorts desc", () => {
    const out = executeQuery(
      ROWS,
      q({ filters: [{ field: "score", op: "gte", value: 50 }], sort: [{ field: "score", dir: "desc" }] }),
    );
    expect(out.map((r) => (r as { id: string }).id)).toEqual(["a", "c", "d"]);
  });

  it("filters dates by between (resolved abs values)", () => {
    const out = executeQuery(
      ROWS,
      q({ filters: [{ field: "due", op: "between", value: [{ abs: "2026-07-01" }, { abs: "2026-07-31" }] }] }),
    );
    expect(out.map((r) => (r as { id: string }).id)).toEqual(["a", "b"]);
  });

  it("honors before/after", () => {
    const before = executeQuery(ROWS, q({ filters: [{ field: "due", op: "before", value: { abs: "2026-07-01" } }] }));
    expect(before.map((r) => (r as { id: string }).id)).toEqual(["d"]);
    const after = executeQuery(ROWS, q({ filters: [{ field: "due", op: "after", value: { abs: "2026-07-31" } }] }));
    expect(after.map((r) => (r as { id: string }).id)).toEqual(["c"]);
  });
});

describe("executeQuery — malformed response", () => {
  it("throws a clear TypeError when the vendor returns a non-array", () => {
    // @ts-expect-error deliberately malformed input
    expect(() => executeQuery({ oops: true }, q({}))).toThrow(/array of rows/);
    // @ts-expect-error deliberately malformed input
    expect(() => executeQuery(null, q({}))).toThrow(/array of rows/);
  });
});

describe("executeQuery — sort with null/undefined fields (review #68)", () => {
  const NULLABLE = [
    { id: "a", n: 5 },
    { id: "b", n: undefined },
    { id: "c", n: 3 },
    { id: "d", n: null },
    { id: "e", n: 8 },
  ];

  it("keeps valid values correctly ordered asc and sinks nils to the end", () => {
    const out = executeQuery(NULLABLE, q({ sort: [{ field: "n", dir: "asc" }] }));
    expect(out.map((r) => (r as { n: unknown }).n)).toEqual([3, 5, 8, undefined, null]);
  });

  it("keeps valid values correctly ordered desc, nils still last", () => {
    const out = executeQuery(NULLABLE, q({ sort: [{ field: "n", dir: "desc" }] }));
    expect(out.map((r) => (r as { n: unknown }).n)).toEqual([8, 5, 3, undefined, null]);
  });

  it("does not reverse well-defined values when a nil sits between them (the repro)", () => {
    const out = executeQuery(
      [{ id: "a", n: 5 }, { id: "b", n: undefined }, { id: "c", n: 3 }],
      q({ sort: [{ field: "n", dir: "asc" }] }),
    );
    expect(out.map((r) => (r as { id: string }).id)).toEqual(["c", "a", "b"]);
  });
});

describe("executeQuery — groups", () => {
  it("groups rows by a field", () => {
    const out = executeQuery(ROWS, q({ groupBy: "risk" })) as { group: string; rows: unknown[] }[];
    expect(out.map((g) => [g.group, g.rows.length])).toEqual([
      ["high", 2],
      ["low", 1],
      ["medium", 1],
    ]);
  });
});

describe("executeQuery — aggregate", () => {
  it("computes field-less count as a single-element array", () => {
    const out = executeQuery(ROWS, q({ aggregations: [{ fn: "count", alias: "n" }] }));
    expect(out).toEqual([{ n: 4 }]);
  });

  it("computes sum/avg/max over a field", () => {
    const out = executeQuery(
      ROWS,
      q({
        aggregations: [
          { fn: "sum", field: "score", alias: "total" },
          { fn: "avg", field: "score", alias: "mean" },
          { fn: "max", field: "score", alias: "peak" },
        ],
      }),
    );
    expect(out).toEqual([{ total: 230, mean: 57.5, peak: 90 }]);
  });

  it("computes aggregations per group when grouped", () => {
    const out = executeQuery(
      ROWS,
      q({ groupBy: "risk", aggregations: [{ fn: "count", alias: "n" }, { fn: "avg", field: "score", alias: "mean" }] }),
    ) as { group: string; n: number; mean: number }[];
    expect(out).toEqual([
      { group: "high", n: 2, mean: 80 },
      { group: "low", n: 1, mean: 20 },
      { group: "medium", n: 1, mean: 50 },
    ]);
  });
});

describe("executeQuery — execution modes", () => {
  it("skips client-side filtering when filter is server-executed", () => {
    const out = executeQuery(
      ROWS,
      q({ filters: [{ field: "risk", op: "eq", value: "high" }] }),
      { execution: { filter: "server" } },
    );
    // Vendor is assumed to have filtered; the engine returns rows as given.
    expect(out).toHaveLength(4);
  });

  it("passes through pre-aggregated rows when aggregate is server-executed", () => {
    const preAggregated = [{ n: 99 }];
    const out = executeQuery(preAggregated, q({ aggregations: [{ fn: "count", alias: "n" }] }), {
      execution: { aggregate: "server" },
    });
    expect(out).toEqual([{ n: 99 }]);
  });
});

describe("executeQuery — row cap", () => {
  it("throws RowCapExceededError when client work exceeds the cap", () => {
    const many = Array.from({ length: 11 }, (_, i) => ({ id: String(i) }));
    expect(() => executeQuery(many, q({ filters: [] }), { maxRows: 10 })).toThrow(RowCapExceededError);
  });

  it("does NOT cap when every operation is server-executed", () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ id: String(i) }));
    const out = executeQuery(many, q({ filters: [] }), {
      maxRows: 10,
      execution: { filter: "server", sort: "server", group: "server", aggregate: "server" },
    });
    expect(out).toHaveLength(50);
  });

  it("error message guides toward server mode", () => {
    try {
      executeQuery([{ id: "1" }, { id: "2" }], q({}), { maxRows: 1 });
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).toMatch(/execution:"server"/);
    }
  });
});

describe("defineEntity execution capability", () => {
  it("defaults execution to all-client and maxClientRows to the default", () => {
    const contract = defineEntity({
      name: "x",
      schema: z.object({ id: z.string() }),
      capabilities: { filterable: [] },
      fetch: async () => [],
    });
    expect(contract.capabilities.execution).toEqual({
      filter: "client",
      sort: "client",
      group: "client",
      aggregate: "client",
    });
    expect(contract.capabilities.maxClientRows).toBe(DEFAULT_MAX_CLIENT_ROWS);
  });

  it("honors per-operation execution overrides", () => {
    const contract = defineEntity({
      name: "x",
      schema: z.object({ id: z.string() }),
      capabilities: { filterable: [], execution: { filter: "server" }, maxClientRows: 500 },
      fetch: async () => [],
    });
    expect(contract.capabilities.execution.filter).toBe("server");
    expect(contract.capabilities.execution.sort).toBe("client");
    expect(contract.capabilities.maxClientRows).toBe(500);
  });

  it("rejects a non-positive maxClientRows", () => {
    expect(() =>
      defineEntity({
        name: "x",
        schema: z.object({ id: z.string() }),
        capabilities: { filterable: [], maxClientRows: 0 },
        fetch: async () => [],
      }),
    ).toThrow(/maxClientRows/);
  });
});

describe("compileToExecutor runs the client-side engine", () => {
  it("filters/sorts the vendor's rows after fetch", async () => {
    const contract = defineEntity({
      name: "case",
      schema: z.object({ id: z.string(), risk: z.enum(["low", "high"]), score: z.number() }),
      capabilities: { filterable: ["risk"], sortable: ["score"] },
      // Vendor returns EVERYTHING; the engine narrows it.
      fetch: async () => ROWS.map(({ id, risk, score }) => ({ id, risk, score })),
    });
    const execute = compileToExecutor(contract);
    const out = await execute({
      query: q({ filters: [{ field: "risk", op: "eq", value: "high" }], sort: [{ field: "score", dir: "desc" }] }),
      auth: null,
    });
    expect(out.map((r) => (r as { id: string }).id)).toEqual(["a", "c"]);
  });
});

describe("executeQuery — performance", () => {
  it("filters + groups 100k rows well under budget", () => {
    const rows = Array.from({ length: 100_000 }, (_, i) => ({
      id: i,
      cat: `c${i % 20}`,
      score: i % 100,
    }));
    const start = performance.now();
    const out = executeQuery(
      rows,
      q({ filters: [{ field: "score", op: "gte", value: 50 }], groupBy: "cat", aggregations: [{ fn: "count", alias: "n" }] }),
      { maxRows: 200_000 },
    ) as { group: string; n: number }[];
    const elapsed = performance.now() - start;

    expect(out).toHaveLength(20); // 20 categories
    expect(out.reduce((s, g) => s + g.n, 0)).toBe(50_000); // score 50..99
    expect(elapsed).toBeLessThan(500); // generous CI budget; typically < 50ms
  });
});
