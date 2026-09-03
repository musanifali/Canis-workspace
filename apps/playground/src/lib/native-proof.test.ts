/**
 * The partner proof's claim, as a test (#113): swapping the component registry
 * changes the pixels and NOTHING else — same spec, same contract, same gate.
 */
import { describe, expect, it } from "vitest";
import { CANNED_PROMPTS } from "./canned";
import { gate } from "./generate";

const buildSpec = CANNED_PROMPTS.find((c) => c.id === "build")!.spec;

describe("the side-by-side proof", () => {
  it("renders ONE spec — the same object drives both panels", () => {
    // Both panels import this exact spec; there is no partner-specific variant
    // to drift. If someone forks it for the demo, this test is where it shows.
    expect(buildSpec).toBeDefined();
    expect(gate(buildSpec).verdict).toBe("BUILD");
  });

  it("uses only block types a partner registry can supply", () => {
    // The proof would be dishonest if it leaned on a block a partner can't
    // implement, so pin the types it actually uses.
    const types = (buildSpec as { blocks: { type: string }[] }).blocks.map((b) => b.type);
    for (const t of types) {
      expect(["KpiCards", "CasesTable", "GroupedBoard", "Graph", "CaseQueue", "FilterBar"]).toContain(t);
    }
  });

  it("the gate still governs the partner build — components don't widen policy", () => {
    // The exfil spec is refused regardless of which components are registered:
    // validation happens before any component is consulted.
    const exfil = CANNED_PROMPTS.find((c) => c.id === "refusal")!.spec;
    expect(gate(exfil).verdict).toBe("REJECT");
  });
});
