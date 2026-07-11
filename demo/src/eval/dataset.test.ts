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

  it("every asserted block type and field exists in the registry / contract", () => {
    const registryTypes = new Set(Object.keys(DEFAULT_REGISTRY));
    const contractFields = new Set(Object.keys(caseContract.fields));
    for (const c of GOLDEN) {
      if (c.expected.verdict !== "build") continue;
      const a = c.expected.assert;
      for (const t of a.blockTypes ?? []) {
        expect(registryTypes, `${c.id} blockType ${t}`).toContain(t);
      }
      const q = a.query;
      for (const f of q?.filters ?? []) expect(contractFields, `${c.id} filter ${f.field}`).toContain(f.field);
      if (q?.groupBy) expect(contractFields, `${c.id} groupBy`).toContain(q.groupBy);
      for (const s of q?.sorts ?? []) expect(contractFields, `${c.id} sort ${s.field}`).toContain(s.field);
      for (const ag of q?.aggregates ?? []) if (ag.field) expect(contractFields, `${c.id} agg ${ag.field}`).toContain(ag.field);
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
