import { describe, expect, it } from "vitest";
import { loadContractModule, toContractMap, ContractLoadError } from "./load.js";
import { CONTRACTS } from "../__fixtures__/paths.js";

describe("loadContractModule", () => {
  it("loads EntityContracts from a real module (default array export)", async () => {
    const contracts = await loadContractModule(CONTRACTS.baseline);
    expect(contracts.map((c) => c.name)).toEqual(["case"]);
    expect(contracts[0]!.capabilities.filterable.has("sla_deadline")).toBe(true);
  });

  it("indexes contracts by entity name", async () => {
    const contracts = await loadContractModule(CONTRACTS.baseline);
    expect(Object.keys(toContractMap(contracts))).toEqual(["case"]);
  });

  it("rejects a module that exports no contract", async () => {
    await expect(loadContractModule(CONTRACTS.empty)).rejects.toBeInstanceOf(
      ContractLoadError,
    );
  });

  it("surfaces a defineEntity failure as a ContractLoadError", async () => {
    await expect(loadContractModule(CONTRACTS.broken)).rejects.toBeInstanceOf(
      ContractLoadError,
    );
  });
});
