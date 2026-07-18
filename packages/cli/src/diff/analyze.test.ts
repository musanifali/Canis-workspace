import { describe, expect, it } from "vitest";
import { analyzeBreakingChanges } from "./analyze.js";
import { loadContractModule, toContractMap } from "../contracts/load.js";
import { loadSpecsFromDir } from "../specs/load.js";
import { CONTRACTS, SPECS_DIR } from "../__fixtures__/paths.js";

describe("analyzeBreakingChanges", () => {
  it("counts the workspaces a narrowing breaks and names the field", async () => {
    const [oldC, newC, specs] = await Promise.all([
      loadContractModule(CONTRACTS.baseline),
      loadContractModule(CONTRACTS.narrowed),
      loadSpecsFromDir(SPECS_DIR),
    ]);

    const analysis = analyzeBreakingChanges(
      specs,
      toContractMap(oldC),
      toContractMap(newC),
    );

    expect(analysis.total).toBe(3);
    expect(analysis.broken).toBe(1);
    expect(analysis.compatible).toBe(2);

    const broken = analysis.impacts.find((i) => i.broken)!;
    expect(broken.id).toBe("sla-breach-watch.json");
    expect(broken.oldVerdict).toBe("BUILD");
    expect(broken.newVerdict).toBe("REJECT");
    // reasons come straight from the validator and name the removed field.
    const text = broken.reasons.map((r) => r.message).join("\n");
    expect(text).toContain("sla_deadline");
    expect(broken.reasons.some((r) => r.field === "sla_deadline")).toBe(true);
  });

  it("finds no breakage for a purely additive change", async () => {
    const [oldC, newC, specs] = await Promise.all([
      loadContractModule(CONTRACTS.baseline),
      loadContractModule(CONTRACTS.widened),
      loadSpecsFromDir(SPECS_DIR),
    ]);

    const analysis = analyzeBreakingChanges(
      specs,
      toContractMap(oldC),
      toContractMap(newC),
    );
    expect(analysis.broken).toBe(0);
    expect(analysis.compatible).toBe(3);
  });
});
