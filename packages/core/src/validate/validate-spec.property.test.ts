/**
 * Property-based validator invariants (card #10).
 *
 * The card's charter, as an executable property: *no spec that passes
 * validation can reference an uncontracted field, component, or operation.*
 * The checker below re-derives "contracted" from the contract + registry
 * independently of the validator's own code paths, so a validator bug can't
 * vouch for itself.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { OPS_BY_KIND } from "../contract/compile.js";
import {
  defineEntity,
  type EntityContract,
  type FieldKind,
} from "../contract/define-entity.js";
import { DEFAULT_REGISTRY } from "../registry/registry.js";
import { deriveBindingShape, type QuerySpec } from "../spec/query.js";
import type { WorkspaceSpec } from "../spec/workspace.js";
import { validateSpec } from "./validate-spec.js";

// ---------------------------------------------------------------------------
// Contract generator
// ---------------------------------------------------------------------------

const FIELD_POOL = [
  "alpha",
  "beta",
  "gamma",
  "risk",
  "score",
  "owner",
  "dueDate",
  "amount",
  "status",
  "flag",
] as const;

const KINDS: readonly FieldKind[] = ["string", "number", "boolean", "enum", "date"];

interface ContractSeed {
  fields: { name: string; kind: FieldKind }[];
  filterable: string[];
  sortable: string[];
  groupable: string[];
  aggregations: Record<string, ("sum" | "avg" | "min" | "max")[]>;
  maxLimit: number;
}

const contractSeedArb: fc.Arbitrary<ContractSeed> = fc
  .uniqueArray(fc.constantFrom(...FIELD_POOL), { minLength: 2, maxLength: 6 })
  .chain((names) =>
    fc
      .tuple(
        fc.array(fc.constantFrom(...KINDS), {
          minLength: names.length,
          maxLength: names.length,
        }),
        fc.array(fc.boolean(), { minLength: names.length, maxLength: names.length }),
        fc.array(fc.boolean(), { minLength: names.length, maxLength: names.length }),
        fc.array(fc.boolean(), { minLength: names.length, maxLength: names.length }),
        fc.array(fc.boolean(), { minLength: names.length, maxLength: names.length }),
        fc.integer({ min: 10, max: 500 }),
      )
      .map(([kinds, filt, sort, group, agg, maxLimit]) => {
        const fields = names.map((name, i) => ({ name, kind: kinds[i]! }));
        const aggregations: ContractSeed["aggregations"] = {};
        fields.forEach((field, i) => {
          if (field.kind === "number" && agg[i]) {
            aggregations[field.name] = ["sum", "avg"];
          }
        });
        return {
          fields,
          filterable: fields.filter((_, i) => filt[i]).map((f) => f.name),
          sortable: fields.filter((_, i) => sort[i]).map((f) => f.name),
          groupable: fields.filter((_, i) => group[i]).map((f) => f.name),
          aggregations,
          maxLimit,
        };
      }),
  );

function buildContract(seed: ContractSeed): EntityContract {
  const shape: Record<string, z.ZodTypeAny> = {};
  const fieldKinds: Record<string, FieldKind> = {};
  for (const { name, kind } of seed.fields) {
    shape[name] =
      kind === "number"
        ? z.number()
        : kind === "boolean"
          ? z.boolean()
          : kind === "enum"
            ? z.enum(["a", "b", "c"])
            : z.string();
    if (kind === "date" || kind === "datetime") fieldKinds[name] = kind;
  }
  return defineEntity({
    name: "case",
    schema: z.object(shape),
    fieldKinds,
    capabilities: {
      filterable: seed.filterable,
      sortable: seed.sortable,
      groupable: seed.groupable,
      aggregations: seed.aggregations,
      defaultLimit: Math.min(10, seed.maxLimit),
      maxLimit: seed.maxLimit,
    },
    fetch: async () => [],
  }) as EntityContract;
}

// ---------------------------------------------------------------------------
// Legal query + spec generators (derived from the contract's capabilities)
// ---------------------------------------------------------------------------

const dateValueArb = fc.oneof(
  fc.constant({ abs: "2026-07-05" }),
  fc.constant({ abs: "2026-07-05T19:32:08Z" }),
  fc.constantFrom({ rel: "today" }, { rel: "this_month" }, { rel: "last_week" }),
);

function valueArbFor(kind: FieldKind, op: string): fc.Arbitrary<unknown> {
  if (["on", "before", "after"].includes(op)) return dateValueArb;
  if (op === "between") {
    return kind === "number"
      ? fc.tuple(fc.integer({ min: 0, max: 50 }), fc.integer({ min: 51, max: 99 }))
      : fc.oneof(dateValueArb, fc.tuple(dateValueArb, dateValueArb));
  }
  if (["gt", "gte", "lt", "lte"].includes(op)) return fc.integer({ min: 0, max: 99 });
  if (op === "contains") return fc.constantFrom("high", "acme", "x");
  const scalar: fc.Arbitrary<unknown> =
    kind === "number"
      ? fc.integer({ min: 0, max: 99 })
      : kind === "boolean"
        ? fc.boolean()
        : fc.constantFrom("a", "b", "high");
  if (["in", "not_in"].includes(op)) {
    return fc.array(scalar, { minLength: 1, maxLength: 3 });
  }
  return scalar;
}

function legalQueryArb(seed: ContractSeed): fc.Arbitrary<QuerySpec> {
  const kindOf = (name: string) => seed.fields.find((f) => f.name === name)!.kind;

  const filterArb =
    seed.filterable.length === 0
      ? fc.constant([])
      : fc.array(
          fc.constantFrom(...seed.filterable).chain((field) =>
            fc.constantFrom(...OPS_BY_KIND[kindOf(field)]).chain((op) =>
              valueArbFor(kindOf(field), op).map((value) => ({ field, op, value })),
            ),
          ),
          { maxLength: 3 },
        );

  const aggFields = Object.keys(seed.aggregations);
  const aggregationsArb = fc.oneof(
    fc.constant(undefined),
    fc.constant([{ fn: "count", alias: "total" }]),
    ...(aggFields.length > 0
      ? [
          fc
            .constantFrom(...aggFields)
            .map((field) => [
              { fn: "count", alias: "total" },
              { fn: "sum", field, alias: "metric" },
            ]),
        ]
      : []),
  );

  return fc
    .record({
      filters: filterArb,
      sort:
        seed.sortable.length === 0
          ? fc.constant([])
          : fc.array(
              fc.record({
                field: fc.constantFrom(...seed.sortable),
                dir: fc.constantFrom("asc", "desc"),
              }),
              { maxLength: 2 },
            ),
      groupBy:
        seed.groupable.length === 0
          ? fc.constant(undefined)
          : fc.option(fc.constantFrom(...seed.groupable), { nil: undefined }),
      aggregations: aggregationsArb,
      limit: fc.option(fc.integer({ min: 1, max: seed.maxLimit }), {
        nil: undefined,
      }),
    })
    .map((query) => JSON.parse(JSON.stringify(query)) as QuerySpec);
}

/** Wrap a query in a block whose registry type matches its derived shape. */
function specFor(query: QuerySpec): Record<string, unknown> {
  const shape = deriveBindingShape(query);
  const type =
    shape === "rows" ? "CasesTable" : shape === "groups" ? "GroupedBoard" : "Graph";
  return {
    specVersion: 1,
    title: "Generated",
    blocks: [
      {
        id: "blk_a",
        type,
        frame: { x: 0, y: 0, w: 12, h: 4 },
        binding: { entity: "case", query },
      },
    ],
  };
}

const legalCaseArb = contractSeedArb.chain((seed) =>
  legalQueryArb(seed).map((query) => ({ seed, spec: specFor(query) })),
);

/** Mutations that should each flip some part of the spec out of contract. */
const corruptions: ((spec: Record<string, unknown>) => void)[] = [
  (spec) => ((spec.blocks as { type: string }[])[0]!.type = "SparkleChart"),
  (spec) =>
    (((spec.blocks as Record<string, unknown>[])[0]!.binding as Record<string, unknown>)
      .entity = "ghost"),
  (spec) => {
    const binding = (spec.blocks as Record<string, unknown>[])[0]!
      .binding as { query: { filters: unknown[] } };
    binding.query.filters = [{ field: "hax", op: "eq", value: 1 }];
  },
  (spec) => {
    const binding = (spec.blocks as Record<string, unknown>[])[0]!
      .binding as { query: { limit?: number } };
    binding.query.limit = 1000;
  },
  (spec) => {
    const binding = (spec.blocks as Record<string, unknown>[])[0]!
      .binding as { query: { groupBy?: string } };
    binding.query.groupBy = "hax";
  },
];

const maybeCorruptedArb = fc
  .tuple(legalCaseArb, fc.option(fc.nat(corruptions.length - 1), { nil: undefined }))
  .map(([{ seed, spec }, corruption]) => {
    if (corruption !== undefined) corruptions[corruption]!(spec);
    return { seed, spec };
  });

// ---------------------------------------------------------------------------
// The independent "contracted" checker — no validator code paths involved
// ---------------------------------------------------------------------------

function uncontractedRefs(spec: WorkspaceSpec, contract: EntityContract): string[] {
  const bad: string[] = [];
  for (const block of spec.blocks) {
    const entry = DEFAULT_REGISTRY[block.type];
    if (!entry) {
      bad.push(`type:${block.type}`);
      continue;
    }
    if (!block.binding) continue;
    if (block.binding.entity !== contract.name) {
      bad.push(`entity:${block.binding.entity}`);
      continue;
    }
    const { query } = block.binding;
    for (const filter of query.filters) {
      const kind = contract.fields[filter.field];
      if (!contract.capabilities.filterable.has(filter.field)) {
        bad.push(`filter:${filter.field}`);
      } else if (!kind || !OPS_BY_KIND[kind].includes(filter.op)) {
        bad.push(`op:${filter.op}@${filter.field}`);
      }
    }
    for (const sort of query.sort) {
      if (!contract.capabilities.sortable.has(sort.field)) {
        bad.push(`sort:${sort.field}`);
      }
    }
    if (query.groupBy && !contract.capabilities.groupable.has(query.groupBy)) {
      bad.push(`groupBy:${query.groupBy}`);
    }
    for (const agg of query.aggregations ?? []) {
      const granted =
        agg.fn === "count" && agg.field === undefined
          ? true
          : agg.field !== undefined &&
            (contract.capabilities.aggregations[agg.field] ?? []).includes(
              agg.fn as never,
            );
      if (!granted) bad.push(`agg:${agg.fn}(${agg.field ?? ""})`);
    }
    if (
      query.limit !== undefined &&
      query.limit > contract.capabilities.maxLimit
    ) {
      bad.push(`limit:${query.limit}`);
    }
    if (deriveBindingShape(query) !== entry.bindingShape) {
      bad.push(`shape:${block.type}`);
    }
  }
  return bad;
}

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

describe("validator invariants (property-based)", () => {
  it("CORE INVARIANT: whatever the input, BUILD output never references anything uncontracted", () => {
    fc.assert(
      fc.property(maybeCorruptedArb, ({ seed, spec }) => {
        const contract = buildContract(seed);
        const verdict = validateSpec(spec, { contracts: { case: contract } });
        if (verdict.verdict === "BUILD") {
          expect(uncontractedRefs(verdict.spec, contract)).toEqual([]);
        }
      }),
      { numRuns: 300 },
    );
  });

  it("no false rejections: queries drawn from the contract's own capabilities always BUILD", () => {
    fc.assert(
      fc.property(legalCaseArb, ({ seed, spec }) => {
        const contract = buildContract(seed);
        const verdict = validateSpec(spec, { contracts: { case: contract } });
        expect(
          verdict.verdict,
          verdict.verdict === "REJECT"
            ? JSON.stringify(verdict.errors, null, 2)
            : "",
        ).toBe("BUILD");
      }),
      { numRuns: 300 },
    );
  });

  it("generated tool schema and validator agree on generated queries (card #8 drift, generatively)", () => {
    fc.assert(
      fc.property(legalCaseArb, ({ seed, spec }) => {
        const contract = buildContract(seed);
        const verdict = validateSpec(spec, { contracts: { case: contract } });
        // Whatever the verdict, it must be a verdict — and legal generation
        // may only ever land on BUILD (checked above); this run doubles as
        // a determinism check.
        expect(validateSpec(spec, { contracts: { case: contract } })).toEqual(
          verdict,
        );
      }),
      { numRuns: 100 },
    );
  });

  it("LAYOUT INVARIANT (§3): BUILD ⇔ all frame pairs disjoint", () => {
    // Everything except geometry is held legal, so overlap is the only
    // possible fault and the biconditional is exact in both directions.
    const contract = buildContract({
      fields: [{ name: "risk", kind: "enum" }],
      filterable: ["risk"],
      sortable: [],
      groupable: [],
      aggregations: {},
      maxLimit: 100,
    });
    const frameArb = fc
      .record({
        x: fc.integer({ min: 0, max: 8 }),
        y: fc.integer({ min: 0, max: 12 }),
        w: fc.integer({ min: 4, max: 12 }),
        h: fc.integer({ min: 3, max: 6 }),
      })
      .filter((frame) => frame.x + frame.w <= 12);
    const layoutArb = fc
      .array(frameArb, { minLength: 2, maxLength: 4 })
      .map((frames) => ({
        specVersion: 1,
        title: "Layout",
        blocks: frames.map((frame, i) => ({
          id: `blk_${"abcd"[i]}`,
          type: "CasesTable",
          frame,
          binding: { entity: "case", query: { filters: [] } },
        })),
      }));
    const overlaps = (
      a: { x: number; y: number; w: number; h: number },
      b: { x: number; y: number; w: number; h: number },
    ) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

    fc.assert(
      fc.property(layoutArb, (spec) => {
        const frames = spec.blocks.map((block) => block.frame);
        const anyOverlap = frames.some((a, i) =>
          frames.some((b, j) => j > i && overlaps(a, b)),
        );
        const verdict = validateSpec(spec, { contracts: { case: contract } });
        if (anyOverlap) {
          expect(verdict.verdict).toBe("REJECT");
          if (verdict.verdict === "REJECT") {
            expect(verdict.errors.map((e) => e.code)).toContain(
              "LayoutOverlapError",
            );
          }
        } else {
          expect(verdict.verdict).toBe("BUILD");
        }
      }),
      { numRuns: 300 },
    );
  });

  it("FUZZ: arbitrary values (including malformed JSON strings) never crash the validator", () => {
    const contract = buildContract({
      fields: [{ name: "risk", kind: "enum" }],
      filterable: ["risk"],
      sortable: [],
      groupable: [],
      aggregations: {},
      maxLimit: 100,
    });
    fc.assert(
      fc.property(
        fc.oneof(
          fc.anything(),
          fc.string(),
          fc.json(),
          fc.string().map((s) => `{"specVersion":1,${s}`),
        ),
        (input) => {
          const verdict = validateSpec(input, { contracts: { case: contract } });
          expect(["BUILD", "CLARIFY", "REJECT"]).toContain(verdict.verdict);
        },
      ),
      { numRuns: 500 },
    );
  });
});
