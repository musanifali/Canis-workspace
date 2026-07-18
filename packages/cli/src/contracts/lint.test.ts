import { describe, expect, it } from "vitest";
import type { EntityContract } from "@workspace-engine/core";
import { lintContracts, hasLintErrors } from "./lint.js";
import { loadContractModule } from "./load.js";
import { CONTRACTS } from "../__fixtures__/paths.js";

describe("lintContracts", () => {
  it("catches every seeded smell class on a valid-but-sloppy contract", async () => {
    const contracts = await loadContractModule(CONTRACTS.smelly);
    const findings = lintContracts(contracts);
    const codes = new Set(findings.map((f) => f.code));

    expect(codes).toContain("missing_entity_description");
    expect(codes).toContain("missing_field_description");
    expect(codes).toContain("vague_field_description");
    expect(codes).toContain("enum_value_undocumented");

    // missing_field_description on both id and amountUsd.
    const missingFields = findings
      .filter((f) => f.code === "missing_field_description")
      .map((f) => f.field);
    expect(missingFields).toEqual(expect.arrayContaining(["id", "amountUsd"]));

    // both enum values flagged as undocumented.
    const undocumented = findings
      .filter((f) => f.code === "enum_value_undocumented")
      .map((f) => f.message);
    expect(undocumented.some((m) => m.includes('"low"'))).toBe(true);
    expect(undocumented.some((m) => m.includes('"high"'))).toBe(true);

    // all smells are warnings — nothing gates CI here.
    expect(hasLintErrors(findings)).toBe(false);
  });

  it("reports nothing for a well-documented contract", async () => {
    const contracts = await loadContractModule(CONTRACTS.clean);
    expect(lintContracts(contracts)).toEqual([]);
  });

  it("flags a capability referencing a field the schema lacks as an error", () => {
    // A hand-built (reconstructed-style) contract that bypasses defineEntity's
    // guard — the structural error class lint must still catch.
    const malformed = {
      name: "case",
      schema: { shape: {} },
      fields: { risk: "enum" },
      capabilities: {
        filterable: new Set(["risk", "ghost_field"]),
        sortable: new Set<string>(),
        groupable: new Set<string>(),
        aggregations: {},
        defaultLimit: 50,
        maxLimit: 200,
        execution: {},
        maxClientRows: 10000,
      },
      fetch: async () => [],
    } as unknown as EntityContract;

    const findings = lintContracts([malformed]);
    const error = findings.find((f) => f.code === "capability_unknown_field");
    expect(error).toBeDefined();
    expect(error!.severity).toBe("error");
    expect(error!.field).toBe("ghost_field");
    expect(hasLintErrors(findings)).toBe(true);
  });
});
