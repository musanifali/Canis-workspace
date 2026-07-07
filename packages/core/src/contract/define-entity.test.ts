import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ContractDefinitionError, defineEntity } from "./define-entity.js";

const caseSchema = z.object({
  id: z.string(),
  title: z.string(),
  risk: z.enum(["low", "medium", "high", "critical"]),
  riskScore: z.number(),
  analyst: z.string(),
  dueDate: z.string(),
  amountUsd: z.number(),
  isEscalated: z.boolean().optional(),
});

/** The DX target from the card: a real entity in under 15 lines. */
function buildCaseContract() {
  return defineEntity({
    name: "case",
    schema: caseSchema,
    fieldKinds: { dueDate: "date" },
    capabilities: {
      filterable: ["risk", "analyst", "dueDate", "riskScore"],
      sortable: ["dueDate", "riskScore"],
      groupable: ["analyst", "risk"],
      aggregations: { amountUsd: ["sum", "avg"], riskScore: ["avg"] },
      defaultLimit: 50,
      maxLimit: 240,
    },
    fetch: async () => [],
  });
}

describe("defineEntity", () => {
  it("builds a contract with derived field kinds + overrides", () => {
    const contract = buildCaseContract();
    expect(contract.fields).toEqual({
      id: "string",
      title: "string",
      risk: "enum",
      riskScore: "number",
      analyst: "string",
      dueDate: "date",
      amountUsd: "number",
      isEscalated: "boolean",
    });
    expect(contract.capabilities.filterable.has("risk")).toBe(true);
    expect(contract.capabilities.filterable.has("title")).toBe(false);
    expect(contract.capabilities.defaultLimit).toBe(50);
    expect(contract.capabilities.maxLimit).toBe(240);
  });

  it("infers literal field names — typos are compile errors AND runtime errors", () => {
    expect(() =>
      defineEntity({
        name: "case",
        schema: caseSchema,
        capabilities: {
          // @ts-expect-error "riks" is not a field of caseSchema — the card's
          // headline requirement; runtime backstop below covers untyped callers
          filterable: ["riks"],
        },
        fetch: async () => [],
      }),
    ).toThrow(ContractDefinitionError);
  });

  it("rejects numeric aggregations on non-number fields", () => {
    expect(() =>
      defineEntity({
        name: "case",
        schema: caseSchema,
        capabilities: {
          filterable: ["risk"],
          aggregations: { analyst: ["sum"] },
        },
        fetch: async () => [],
      }),
    ).toThrow(/requires a number field/);
  });

  it("rejects inconsistent limits", () => {
    expect(() =>
      defineEntity({
        name: "case",
        schema: caseSchema,
        capabilities: {
          filterable: ["risk"],
          defaultLimit: 100,
          maxLimit: 50,
        },
        fetch: async () => [],
      }),
    ).toThrow(/defaultLimit/);
  });

  it("rejects unsupported zod field types with a pointer to fieldKinds", () => {
    expect(() =>
      defineEntity({
        name: "bad",
        schema: z.object({ blob: z.record(z.string()) }),
        capabilities: { filterable: [] },
        fetch: async () => [],
      }),
    ).toThrow(/fieldKinds/);
  });

  it("stores the vendor executor with typed query + auth args", async () => {
    let received: unknown;
    const contract = defineEntity({
      name: "case",
      schema: caseSchema,
      capabilities: { filterable: ["risk"] },
      fetch: async ({ query, auth }) => {
        received = { limit: query.limit, auth };
        return [];
      },
    });
    await contract.fetch({
      query: { filters: [], sort: [], limit: 10 },
      auth: { token: "end-user" },
    });
    expect(received).toEqual({ limit: 10, auth: { token: "end-user" } });
  });

  it("unwraps optional/default/effects wrappers when deriving kinds", () => {
    const contract = defineEntity({
      name: "wrapped",
      schema: z.object({
        a: z.string().optional(),
        b: z.number().default(0),
        c: z.string().transform((s) => s.trim()),
      }),
      capabilities: { filterable: ["a", "b"] },
      fetch: async () => [],
    });
    expect(contract.fields).toEqual({ a: "string", b: "number", c: "string" });
  });
});
