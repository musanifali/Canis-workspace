/**
 * The playground's safety guarantee, deterministically: every canned prompt is
 * gated by the SAME validateSpec the product ships, and the exfil/injection
 * prompts come back REJECT with a reason — never a render.
 */
import { describe, expect, it } from "vitest";
import { CANNED_PROMPTS } from "./canned.js";
import { gate, toResult } from "./generate.js";

const byId = (id: string) => CANNED_PROMPTS.find((c) => c.id === id)!;

describe("the gate over canned prompts", () => {
  it("BUILD prompt → a renderable spec", () => {
    const v = gate(byId("build").spec);
    expect(v.verdict).toBe("BUILD");
  });

  it("refinement prompt → BUILD", () => {
    expect(gate(byId("refine").spec).verdict).toBe("BUILD");
  });

  it("FEATURED refusal (asks for a field the contract lacks) → REJECT with a reason", () => {
    const v = gate(byId("refusal").spec);
    expect(v.verdict).toBe("REJECT");
    const r = toResult(v);
    expect(r.verdict).toBe("REJECT");
    if (r.verdict === "REJECT") {
      expect(r.reasons.length).toBeGreaterThan(0);
      expect(r.reasons[0]!.message).toBeTruthy();
      expect(r.reasons[0]!.fix).toBeTruthy();
    }
  });

  it("injection/exfil (group by an undeclared field) → REJECT, not a dump", () => {
    const v = gate(byId("injection").spec);
    expect(v.verdict).toBe("REJECT");
  });

  it("every featured prompt is a refusal path", () => {
    for (const c of CANNED_PROMPTS.filter((p) => p.featured)) {
      expect(gate(c.spec).verdict).toBe("REJECT");
    }
  });
});
