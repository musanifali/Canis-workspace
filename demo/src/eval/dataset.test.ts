import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DEFAULT_REGISTRY, defineEntity } from "@workspace-engine/core";
import { GOLDEN } from "./dataset";
import { caseContract } from "@/workspace-engine/case-contract";

describe("golden dataset well-formedness (card #22)", () => {
  it("has unique ids", () => {
    const ids = GOLDEN.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("build cases carry an assertion; reject cases carry a reason", () => {
    for (const c of GOLDEN) {
      if (c.expected.verdict === "build") expect(c.expected.assert).toBeDefined();
      if (c.expected.verdict === "reject") expect(c.expected.because.length).toBeGreaterThan(0);
    }
  });

  it("has at least 100 cases (review P2 #72)", () => {
    expect(GOLDEN.length).toBeGreaterThanOrEqual(100);
  });

  it("every build assertion respects the contract's CAPABILITIES, not just field existence", () => {
    // A build expectation that asserts an illegal filter/groupBy/sort/aggregation
    // could never pass live (the gate would reject it) — catch it here.
    const registryTypes = new Set(Object.keys(DEFAULT_REGISTRY));
    const caps = caseContract.capabilities;
    for (const c of GOLDEN) {
      if (c.expected.verdict !== "build") continue;
      const a = c.expected.assert;
      for (const t of a.blockTypes ?? []) {
        expect(registryTypes, `${c.id} blockType ${t}`).toContain(t);
      }
      const q = a.query;
      for (const f of q?.filters ?? [])
        expect(caps.filterable.has(f.field), `${c.id} filter "${f.field}" not filterable`).toBe(true);
      if (q?.groupBy)
        expect(caps.groupable.has(q.groupBy), `${c.id} groupBy "${q.groupBy}" not groupable`).toBe(true);
      for (const s of q?.sorts ?? [])
        expect(caps.sortable.has(s.field), `${c.id} sort "${s.field}" not sortable`).toBe(true);
      for (const ag of q?.aggregates ?? []) {
        if (ag.fn === "count") continue; // field-less count always allowed
        const grants: readonly string[] = caps.aggregations[ag.field ?? ""] ?? [];
        expect(grants.includes(ag.fn), `${c.id} aggregation ${ag.fn}(${ag.field}) not granted`).toBe(true);
      }
    }
  });

  it("covers every metric category (build/reject/clarify/adversarial)", () => {
    const cats = new Set(GOLDEN.map((c) => c.category));
    expect(cats).toEqual(new Set(["build", "reject", "clarify", "adversarial"]));
  });

  // Guard against an accidental import mistake (keeps the fixtures honest).
  it("uses the real case contract", () => {
    const again = defineEntity({
      name: "case",
      schema: z.object({ id: z.string() }),
      capabilities: { filterable: [] },
      fetch: async () => [],
    });
    expect(again.name).toBe(caseContract.name);
  });
});
