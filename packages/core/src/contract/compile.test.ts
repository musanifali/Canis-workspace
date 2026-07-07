import { describe, expect, it } from "vitest";
import { z } from "zod";
import { querySpecSchema, type QuerySpec } from "../spec/query.js";
import {
  compileToExecutor,
  compileToTools,
  compileToValidator,
  QueryPolicyError,
} from "./compile.js";
import { defineEntity } from "./define-entity.js";

const caseContract = defineEntity({
  name: "case",
  schema: z.object({
    id: z.string(),
    title: z.string(),
    risk: z.enum(["low", "medium", "high", "critical"]),
    riskScore: z.number(),
    analyst: z.string(),
    dueDate: z.string(),
    amountUsd: z.number(),
  }),
  fieldKinds: { dueDate: "date" },
  capabilities: {
    filterable: ["risk", "analyst", "dueDate", "riskScore"],
    sortable: ["dueDate", "riskScore"],
    groupable: ["analyst", "risk"],
    aggregations: { amountUsd: ["sum", "avg"], riskScore: ["avg"] },
    defaultLimit: 50,
    maxLimit: 240,
  },
  fetch: async () => [],
});

/** The §11 flagship query — legal under the contract on every path. */
const legalQuery: QuerySpec = {
  filters: [
    { field: "risk", op: "in", value: ["high", "critical"] },
    { field: "dueDate", op: "between", value: { rel: "this_month" } },
    { field: "riskScore", op: "gte", value: 70 },
  ],
  sort: [{ field: "riskScore", dir: "desc" }],
  groupBy: "analyst",
  aggregations: [
    { fn: "count", alias: "total" },
    { fn: "sum", field: "amountUsd", alias: "exposure" },
  ],
  limit: 100,
};

/** Shape-valid queries the CONTRACT must reject, with the expected code. */
const illegalQueries: { name: string; query: QuerySpec; code: string }[] = [
  {
    name: "filter on non-filterable field",
    query: { filters: [{ field: "title", op: "eq", value: "x" }], sort: [] },
    code: "not_filterable",
  },
  {
    name: "filter on unknown field",
    query: { filters: [{ field: "riks", op: "eq", value: "x" }], sort: [] },
    code: "unknown_field",
  },
  {
    name: "op illegal for field kind (contains on enum)",
    query: { filters: [{ field: "risk", op: "contains", value: "hi" }], sort: [] },
    code: "op_not_allowed",
  },
  {
    name: "op illegal for field kind (gt on date)",
    query: { filters: [{ field: "dueDate", op: "gt", value: 5 }], sort: [] },
    code: "op_not_allowed",
  },
  {
    name: "sort on non-sortable field",
    query: { filters: [], sort: [{ field: "analyst", dir: "asc" }] },
    code: "not_sortable",
  },
  {
    name: "groupBy on non-groupable field",
    query: { filters: [], sort: [], groupBy: "dueDate" },
    code: "not_groupable",
  },
  {
    name: "aggregation fn not granted for field (sum riskScore)",
    query: {
      filters: [],
      sort: [],
      aggregations: [{ fn: "sum", field: "riskScore", alias: "s" }],
    },
    code: "aggregation_not_allowed",
  },
  {
    name: "limit above the contract ceiling",
    query: { filters: [], sort: [], limit: 500 },
    code: "limit_exceeded",
  },
];

describe("compileToValidator", () => {
  const validate = compileToValidator(caseContract);

  it("passes the flagship legal query with zero violations", () => {
    expect(validate(legalQuery)).toEqual([]);
  });

  it.each(illegalQueries)("rejects: $name", ({ query, code }) => {
    const violations = validate(query);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.map((v) => v.code)).toContain(code);
  });

  it("collects multiple violations instead of stopping at the first", () => {
    const violations = validate({
      filters: [{ field: "title", op: "eq", value: "x" }],
      sort: [{ field: "analyst", dir: "asc" }],
      limit: 999,
    });
    expect(violations.map((v) => v.code).sort()).toEqual([
      "limit_exceeded",
      "not_filterable",
      "not_sortable",
    ]);
  });
});

describe("compileToTools", () => {
  const [tool] = compileToTools(caseContract);

  it("emits one query tool named after the entity", () => {
    expect(compileToTools(caseContract)).toHaveLength(1);
    expect(tool!.name).toBe("query_case");
    expect(tool!.description).toContain('"case"');
    expect(tool!.description).toContain("240");
  });

  it("accepts the flagship legal query", () => {
    expect(tool!.inputSchema.safeParse(legalQuery).success).toBe(true);
  });

  it("accepts a field-less count without any aggregation grants", () => {
    const bare = defineEntity({
      name: "note",
      schema: z.object({ id: z.string(), body: z.string() }),
      capabilities: { filterable: ["body"] },
      fetch: async () => [],
    });
    const [noteTool] = compileToTools(bare);
    const parsed = noteTool!.inputSchema.safeParse({
      aggregations: [{ fn: "count", alias: "total" }],
    });
    expect(parsed.success).toBe(true);
  });

  it("caps limit at the contract's maxLimit, not the grammar's 1000", () => {
    expect(tool!.inputSchema.safeParse({ limit: 240 }).success).toBe(true);
    expect(tool!.inputSchema.safeParse({ limit: 241 }).success).toBe(false);
  });
});

describe("tool schema ⇔ validator drift guard (card #8: shared source)", () => {
  const [tool] = compileToTools(caseContract);
  const validate = compileToValidator(caseContract);

  const agree = (query: QuerySpec) => {
    // Both paths start from a shape-valid query (the grammar's job)…
    expect(querySpecSchema.safeParse(query).success).toBe(true);
    // …then the generated schema and the validator must agree on policy.
    const toolAccepts = tool!.inputSchema.safeParse(query).success;
    const validatorAccepts = validate(query).length === 0;
    expect(toolAccepts, JSON.stringify(query)).toBe(validatorAccepts);
    return toolAccepts;
  };

  it("agrees on the legal query (both accept)", () => {
    expect(agree(legalQuery)).toBe(true);
  });

  it.each(illegalQueries)("agrees on: $name (both reject)", ({ query }) => {
    expect(agree(query)).toBe(false);
  });
});

describe("compileToExecutor", () => {
  const makeContract = (
    onFetch: (args: { query: QuerySpec; auth: unknown }) => void,
  ) =>
    defineEntity({
      name: "case",
      schema: z.object({ id: z.string(), risk: z.enum(["low", "high"]) }),
      capabilities: { filterable: ["risk"], defaultLimit: 25, maxLimit: 100 },
      fetch: async (args) => {
        onFetch(args);
        return [{ id: "c1" }];
      },
    });

  it("passes the user's auth token through to fetch() unchanged", async () => {
    let seen: unknown;
    const execute = compileToExecutor(makeContract((args) => (seen = args.auth)));
    const auth = { userToken: "usr_abc", tenant: "t1" };
    const rows = await execute({ query: { filters: [], sort: [] }, auth });
    expect(seen).toBe(auth); // same reference — never copied or reshaped
    expect(rows).toEqual([{ id: "c1" }]);
  });

  it("applies the contract's defaultLimit when the query omits one", async () => {
    let seen: QuerySpec | undefined;
    const execute = compileToExecutor(makeContract((args) => (seen = args.query)));
    await execute({ query: { filters: [], sort: [] }, auth: null });
    expect(seen?.limit).toBe(25);
  });

  it("keeps an explicit in-bounds limit", async () => {
    let seen: QuerySpec | undefined;
    const execute = compileToExecutor(makeContract((args) => (seen = args.query)));
    await execute({ query: { filters: [], sort: [], limit: 7 }, auth: null });
    expect(seen?.limit).toBe(7);
  });

  it("throws QueryPolicyError (and never calls fetch) on a violating query", async () => {
    let called = false;
    const execute = compileToExecutor(makeContract(() => (called = true)));
    await expect(
      execute({ query: { filters: [], sort: [], limit: 5000 }, auth: null }),
    ).rejects.toThrow(QueryPolicyError);
    expect(called).toBe(false);
  });
});
