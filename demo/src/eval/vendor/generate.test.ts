import { describe, expect, it } from "vitest";
import { generateEvalCases } from "./generate";
import { caseContract } from "@/workspace-engine/case-contract";

const cases = generateEvalCases([caseContract]);
const caps = caseContract.capabilities;

describe("generateEvalCases — contract-seeded prompts (card #45)", () => {
  it("emits cases with unique ids and non-empty prompts", () => {
    expect(cases.length).toBeGreaterThan(10);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    for (const c of cases) expect(c.prompt.length).toBeGreaterThan(0);
  });

  it("generates one groupBy case per GROUPABLE field, asserting that field", () => {
    for (const field of caps.groupable) {
      const match = cases.find(
        (c) => c.expected.verdict === "build" && c.expected.assert.query?.groupBy === field,
      );
      expect(match, `groupBy ${field}`).toBeDefined();
    }
  });

  it("every generated build assertion respects the contract's capabilities", () => {
    // Correct by construction — the same invariant the golden dataset is held to.
    for (const c of cases) {
      if (c.expected.verdict !== "build") continue;
      const q = c.expected.assert.query;
      if (q?.groupBy) expect(caps.groupable.has(q.groupBy)).toBe(true);
      for (const s of q?.sorts ?? []) expect(caps.sortable.has(s.field)).toBe(true);
      for (const a of q?.aggregates ?? []) {
        if (a.fn === "count") continue;
        expect((caps.aggregations[a.field ?? ""] ?? []).includes(a.fn as never)).toBe(true);
      }
    }
  });

  it("includes out-of-contract reject probes (missing field IS the ask)", () => {
    const rejects = cases.filter((c) => c.expected.verdict === "reject");
    expect(rejects.length).toBeGreaterThan(0);
    for (const r of rejects) expect(r.prompt).toMatch(/group/i);
  });
});
