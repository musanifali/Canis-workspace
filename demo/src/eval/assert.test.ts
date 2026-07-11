import { describe, expect, it } from "vitest";
import { assertSpec } from "./assert";
import { demoWorkspaces } from "@/workspace-engine/specs";

// Portfolio by Category = a KpiCards + a GroupedBoard groupBy category.
const portfolio = demoWorkspaces.find((w) => w.id === "category")!.spec;

describe("assertSpec — structural spec expectations (card #22)", () => {
  it("passes when the required block type is present", () => {
    expect(assertSpec(portfolio, { blockTypes: ["GroupedBoard"] }).pass).toBe(true);
  });

  it("fails, naming the found types, when a block type is missing", () => {
    const r = assertSpec(portfolio, { blockTypes: ["FilterBar"] });
    expect(r.pass).toBe(false);
    expect(r.failures[0]).toMatch(/expected a FilterBar/);
  });

  it("matches a groupBy on some block's query", () => {
    expect(assertSpec(portfolio, { query: { groupBy: "category" } }).pass).toBe(true);
    expect(assertSpec(portfolio, { query: { groupBy: "analyst" } }).pass).toBe(false);
  });

  it("requires the whole query expectation on ONE block", () => {
    const spec = {
      specVersion: 1 as const,
      title: "t",
      timezone: "viewer" as const,
      refresh: { mode: "manual" as const },
      layout: { columns: 12 as const },
      blocks: [
        { id: "blk_a", type: "GroupedBoard", frame: { x: 0, y: 0, w: 12, h: 6 }, config: {},
          binding: { entity: "case", query: { filters: [{ field: "risk", op: "in", value: ["high"] }], groupBy: "analyst" } } },
      ],
    };
    // Both on the same block → pass.
    expect(assertSpec(spec as never, { query: { groupBy: "analyst", filters: [{ field: "risk" }] } }).pass).toBe(true);
    // A filter that isn't there → fail.
    expect(assertSpec(spec as never, { query: { groupBy: "analyst", filters: [{ field: "status" }] } }).pass).toBe(false);
  });

  it("compares filter values order-insensitively when asserted", () => {
    const spec = {
      specVersion: 1, title: "t", timezone: "viewer", refresh: { mode: "manual" }, layout: { columns: 12 },
      blocks: [{ id: "blk_a", type: "CasesTable", frame: { x: 0, y: 0, w: 12, h: 6 }, config: {},
        binding: { entity: "case", query: { filters: [{ field: "risk", op: "in", value: ["high", "critical"] }] } } }],
    };
    expect(assertSpec(spec as never, { query: { filters: [{ field: "risk", value: ["critical", "high"] }] } }).pass).toBe(true);
  });
});
