import { describe, expect, it } from "vitest";
import { z } from "zod";
import { compileToValidator } from "./compile.js";
import { defineEntity } from "./define-entity.js";
import {
  ContractRevivalError,
  reviveContract,
  serializeContract,
} from "./serialize-contract.js";

const caseContract = defineEntity({
  name: "case",
  schema: z.object({
    id: z.string(),
    title: z.string(),
    risk: z.enum(["low", "medium", "high"]),
    status: z.string(),
    riskScore: z.number(),
    dueDate: z.string(),
  }),
  fieldKinds: { dueDate: "date" },
  capabilities: {
    filterable: ["risk", "status", "title", "dueDate"],
    sortable: ["riskScore", "dueDate"],
    groupable: ["risk", "status"],
    aggregations: { riskScore: ["avg", "max"] },
    defaultLimit: 50,
    maxLimit: 200,
  },
  fetch: async () => [],
});

describe("serializeContract / reviveContract", () => {
  it("round-trips the declarative surface the validator reads", () => {
    const revived = reviveContract(serializeContract(caseContract));

    expect(revived.name).toBe("case");
    expect(revived.fields).toEqual(caseContract.fields);
    expect([...revived.capabilities.filterable]).toEqual([
      ...caseContract.capabilities.filterable,
    ]);
    expect([...revived.capabilities.sortable]).toEqual([
      ...caseContract.capabilities.sortable,
    ]);
    expect([...revived.capabilities.groupable]).toEqual([
      ...caseContract.capabilities.groupable,
    ]);
    expect(revived.capabilities.aggregations).toEqual(
      caseContract.capabilities.aggregations,
    );
    expect(revived.capabilities.maxLimit).toBe(200);
  });

  it("produces a JSON-safe value (survives a JSON round-trip)", () => {
    const serialized = serializeContract(caseContract);
    const throughJson = JSON.parse(JSON.stringify(serialized));
    expect(throughJson).toEqual(serialized);
    // And a JSON-revived contract still validates identically.
    expect(reviveContract(throughJson).fields).toEqual(caseContract.fields);
  });

  it("a revived contract drives compileToValidator identically", () => {
    const original = compileToValidator(caseContract);
    const revived = compileToValidator(
      reviveContract(serializeContract(caseContract)),
    );
    const query = {
      filters: [{ field: "ssn", op: "eq", value: "x" } as const],
      sort: [],
    };
    expect(revived(query)).toEqual(original(query));
    expect(revived(query)[0]?.code).toBe("unknown_field");
  });

  it("a revived contract's fetch throws (validation-only)", () => {
    const revived = reviveContract(serializeContract(caseContract));
    expect(() => revived.fetch({ query: { filters: [], sort: [] }, auth: null })).toThrow(
      ContractRevivalError,
    );
  });

  it("rejects a malformed definition", () => {
    expect(() => reviveContract({ name: "case" })).toThrow(ContractRevivalError);
    expect(() => reviveContract({ nope: true })).toThrow(ContractRevivalError);
  });
});
