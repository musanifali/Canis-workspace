import { describe, expect, it } from "vitest";
import { diffContracts } from "./static-diff.js";
import { loadContractModule } from "./load.js";
import { CONTRACTS } from "../__fixtures__/paths.js";

describe("diffContracts", () => {
  it("reports removed field + capabilities as narrowing", async () => {
    const [oldC, newC] = await Promise.all([
      loadContractModule(CONTRACTS.baseline),
      loadContractModule(CONTRACTS.narrowed),
    ]);
    const diff = diffContracts(oldC, newC);
    expect(diff.hasNarrowing).toBe(true);

    const caseDiff = diff.entities.find((e) => e.entity === "case")!;
    expect(caseDiff.fieldsRemoved).toContain("sla_deadline");
    const removedFields = caseDiff.capabilitiesRemoved.map((r) => r.field);
    expect(removedFields).toContain("sla_deadline");
    // filterable + sortable removals both present.
    const removedCaps = caseDiff.capabilitiesRemoved.map((r) => r.capability);
    expect(removedCaps).toContain("filterable");
    expect(removedCaps).toContain("sortable");
  });

  it("reports a purely additive change with no narrowing", async () => {
    const [oldC, newC] = await Promise.all([
      loadContractModule(CONTRACTS.baseline),
      loadContractModule(CONTRACTS.widened),
    ]);
    const diff = diffContracts(oldC, newC);
    expect(diff.hasNarrowing).toBe(false);
    const caseDiff = diff.entities.find((e) => e.entity === "case")!;
    expect(caseDiff.fieldsAdded).toContain("region");
    expect(caseDiff.fieldsRemoved).toEqual([]);
    expect(caseDiff.capabilitiesRemoved).toEqual([]);
  });

  it("flags an entity removed entirely", () => {
    const diff = diffContracts(
      [{ name: "invoice", fields: {}, capabilities: fakeCaps() } as never],
      [],
    );
    expect(diff.entities).toEqual([
      expect.objectContaining({ entity: "invoice", status: "removed" }),
    ]);
    expect(diff.hasNarrowing).toBe(true);
  });
});

function fakeCaps() {
  return {
    filterable: new Set<string>(),
    sortable: new Set<string>(),
    groupable: new Set<string>(),
    aggregations: {},
    defaultLimit: 50,
    maxLimit: 200,
    execution: {},
    maxClientRows: 10000,
  };
}
