/**
 * Type-level tests (card #43). defineEntity's literal-type inference is the
 * headline DX feature: a typo in a capability list must be a COMPILE error, in
 * the customer's editor, not a runtime surprise. A refactor can break inference
 * while every runtime test stays green — so these are the product tests for it.
 *
 * Run via `vitest --typecheck`; `@ts-expect-error` asserts that the following
 * line fails to compile (an unused directive is itself an error, so a
 * regression that stops rejecting typos fails this suite).
 */
import { describe, expectTypeOf, it } from "vitest";
import { z } from "zod";
import { defineEntity, type EntityContract } from "./define-entity.js";

const schema = z.object({
  id: z.string(),
  risk: z.enum(["low", "high"]),
  score: z.number(),
});

describe("defineEntity literal-type inference", () => {
  it("accepts only schema field names in every capability list", () => {
    defineEntity({
      name: "case",
      schema,
      capabilities: {
        filterable: ["id", "risk"],
        sortable: ["score"],
        groupable: ["risk"],
        aggregations: { score: ["avg", "max"] },
      },
      fetch: async () => [],
    });
  });

  it("rejects an unknown filterable field", () => {
    defineEntity({
      name: "case",
      schema,
      capabilities: {
        // @ts-expect-error "risks" is a typo — not a field of the schema
        filterable: ["risks"],
      },
      fetch: async () => [],
    });
  });

  it("rejects an unknown sortable field", () => {
    defineEntity({
      name: "case",
      schema,
      // @ts-expect-error "created" is not a field of the schema
      capabilities: { filterable: [], sortable: ["created"] },
      fetch: async () => [],
    });
  });

  it("rejects an unknown groupable field", () => {
    defineEntity({
      name: "case",
      schema,
      // @ts-expect-error "team" is not a field of the schema
      capabilities: { filterable: [], groupable: ["team"] },
      fetch: async () => [],
    });
  });

  it("rejects an unknown aggregations key", () => {
    defineEntity({
      name: "case",
      schema,
      // @ts-expect-error "amount" is not a field of the schema
      capabilities: { filterable: [], aggregations: { amount: ["sum"] } },
      fetch: async () => [],
    });
  });

  it("rejects an unknown fieldKinds key", () => {
    defineEntity({
      name: "case",
      schema,
      // @ts-expect-error "opened" is not a field of the schema
      fieldKinds: { opened: "date" },
      capabilities: { filterable: [] },
      fetch: async () => [],
    });
  });

  it("infers a well-typed contract", () => {
    const contract = defineEntity({
      name: "case",
      schema,
      capabilities: { filterable: ["risk"] },
      fetch: async () => [],
    });
    expectTypeOf(contract).toMatchTypeOf<EntityContract>();
    expectTypeOf(contract.name).toBeString();
    expectTypeOf(contract.fetch).parameter(0).toMatchTypeOf<{ auth: unknown }>();
  });
});
