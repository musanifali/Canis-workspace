import { describe, expect, it } from "vitest";
import { parseSpec, serializeSpec, SpecParseError } from "./serde.js";
import { workspaceSpecSchema } from "./workspace.js";

/** The worked example from devdocs/workspace-spec-v1.md §11 — the flagship prompt. */
const flagshipSpec = {
  specVersion: 1,
  title: "High-risk cases due this month",
  timezone: "viewer",
  refresh: { mode: "manual" },
  layout: { columns: 12 },
  blocks: [
    {
      id: "blk_kpis",
      type: "KpiCards",
      frame: { x: 0, y: 0, w: 12, h: 2 },
      config: { title: null },
      binding: {
        entity: "case",
        query: {
          filters: [
            { field: "risk", op: "in", value: ["high", "critical"] },
            { field: "dueDate", op: "between", value: { rel: "this_month" } },
          ],
          aggregations: [{ fn: "count", alias: "total" }],
        },
      },
    },
    {
      id: "blk_board",
      type: "GroupedBoard",
      frame: { x: 0, y: 2, w: 12, h: 8 },
      config: { title: "By analyst" },
      binding: {
        entity: "case",
        query: {
          filters: [
            { field: "risk", op: "in", value: ["high", "critical"] },
            { field: "dueDate", op: "between", value: { rel: "this_month" } },
          ],
          groupBy: "analyst",
          sort: [{ field: "riskScore", dir: "desc" }],
          limit: 100,
        },
      },
    },
  ],
};

describe("workspaceSpecSchema", () => {
  it("accepts the flagship worked example from the spec doc", () => {
    const spec = parseSpec(flagshipSpec);
    expect(spec.blocks).toHaveLength(2);
    expect(spec.blocks[1]?.binding?.query.groupBy).toBe("analyst");
  });

  it("applies defaults for timezone, refresh, layout, filters, sort", () => {
    const spec = parseSpec({
      specVersion: 1,
      title: "Minimal",
      blocks: [
        {
          id: "blk_a",
          type: "CasesTable",
          frame: { x: 0, y: 0, w: 6, h: 4 },
          binding: { entity: "case", query: {} },
        },
      ],
    });
    expect(spec.timezone).toBe("viewer");
    expect(spec.refresh).toEqual({ mode: "manual" });
    expect(spec.layout).toEqual({ columns: 12 });
    expect(spec.blocks[0]?.binding?.query.filters).toEqual([]);
    expect(spec.blocks[0]?.config).toEqual({});
  });

  it("rejects unknown top-level keys (SpecShapeError semantics)", () => {
    expect(() =>
      parseSpec({ ...flagshipSpec, surprise: true }),
    ).toThrow(SpecParseError);
  });

  it("rejects a wrong specVersion", () => {
    expect(() => parseSpec({ ...flagshipSpec, specVersion: 2 })).toThrow(
      SpecParseError,
    );
  });

  it("rejects duplicate block ids", () => {
    const dupe = structuredClone(flagshipSpec) as Record<string, unknown>;
    const blocks = dupe.blocks as { id: string }[];
    blocks[1]!.id = "blk_kpis";
    expect(() => parseSpec(dupe)).toThrow(/unique/);
  });

  it("rejects a frame that overflows the grid", () => {
    const bad = structuredClone(flagshipSpec) as {
      blocks: { frame: { x: number; w: number } }[];
    };
    bad.blocks[0]!.frame = { ...bad.blocks[0]!.frame, x: 8, w: 8 };
    expect(() => parseSpec(bad)).toThrow(/fit the grid/);
  });

  it("rejects an empty `in` filter array (empty means the LLM layer failed to strip it)", () => {
    const bad = structuredClone(flagshipSpec) as {
      blocks: { binding: { query: { filters: unknown[] } } }[];
    };
    bad.blocks[0]!.binding.query.filters = [
      { field: "risk", op: "in", value: [] },
    ];
    expect(() => parseSpec(bad)).toThrow(SpecParseError);
  });

  it("rejects a non-count aggregation without a field", () => {
    const bad = structuredClone(flagshipSpec) as {
      blocks: { binding: { query: { aggregations?: unknown[] } } }[];
    };
    bad.blocks[0]!.binding.query.aggregations = [{ fn: "sum", alias: "s" }];
    expect(() => parseSpec(bad)).toThrow(/requires a field/);
  });

  it("rejects more than 3 sort entries", () => {
    const bad = structuredClone(flagshipSpec) as {
      blocks: { binding: { query: { sort?: unknown[] } } }[];
    };
    bad.blocks[1]!.binding.query.sort = [
      { field: "a", dir: "asc" },
      { field: "b", dir: "asc" },
      { field: "c", dir: "asc" },
      { field: "d", dir: "asc" },
    ];
    expect(() => parseSpec(bad)).toThrow(SpecParseError);
  });

  it("rejects out-of-bounds limits (Phase 0: unbounded limit corrupted results)", () => {
    for (const limit of [0, -1, 5.5, 1001]) {
      const bad = structuredClone(flagshipSpec) as {
        blocks: { binding: { query: { limit?: number } } }[];
      };
      bad.blocks[1]!.binding.query.limit = limit;
      expect(() => parseSpec(bad), `limit ${limit}`).toThrow(SpecParseError);
    }
  });

  it("accepts a static block with binding: null", () => {
    const spec = parseSpec({
      specVersion: 1,
      title: "Static",
      blocks: [
        {
          id: "blk_note",
          type: "Note",
          frame: { x: 0, y: 0, w: 12, h: 1 },
          binding: null,
        },
      ],
    });
    expect(spec.blocks[0]?.binding).toBeNull();
  });

  it("accepts relative dates with offsets and pinned IANA timezones", () => {
    const spec = parseSpec({
      specVersion: 1,
      title: "Due soon",
      timezone: "Europe/Berlin",
      blocks: [
        {
          id: "blk_a",
          type: "CasesTable",
          frame: { x: 0, y: 0, w: 12, h: 4 },
          binding: {
            entity: "case",
            query: {
              filters: [
                {
                  field: "dueDate",
                  op: "before",
                  value: { rel: "today", offsetDays: 7 },
                },
              ],
            },
          },
        },
      ],
    });
    expect(spec.timezone).toBe("Europe/Berlin");
  });

  it("rejects a garbage timezone", () => {
    expect(() =>
      parseSpec({ ...flagshipSpec, timezone: "next tuesday" }),
    ).toThrow(SpecParseError);
  });
});

describe("round-trip (card DUx7yjkT criterion)", () => {
  it("parse(serialize(spec)) deep-equals spec", () => {
    const spec = parseSpec(flagshipSpec);
    const roundTripped = parseSpec(serializeSpec(spec));
    expect(roundTripped).toEqual(spec);
  });

  it("serialization is canonical: equal specs serialize identically", () => {
    const a = parseSpec(flagshipSpec);
    // Same spec built with different key order
    const shuffled = JSON.parse(JSON.stringify(flagshipSpec)) as Record<
      string,
      unknown
    >;
    const reordered = Object.fromEntries(Object.entries(shuffled).reverse());
    const b = parseSpec(reordered);
    expect(serializeSpec(a)).toBe(serializeSpec(b));
  });

  it("safeParse mirrors parseSpec for direct schema users", () => {
    expect(workspaceSpecSchema.safeParse(flagshipSpec).success).toBe(true);
  });
});
