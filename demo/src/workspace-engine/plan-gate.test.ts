import { describe, expect, it } from "vitest";
import type { EntityContract, ValidationContext } from "@workspace-engine/core";
import { gatePlan } from "./plan-gate";
import { contracts } from "./kit";
import { demoWorkspaces } from "./specs";

const ctx: ValidationContext = {
  contracts: Object.fromEntries(
    contracts.map((c: EntityContract) => [c.name, c]),
  ),
};

/** A one-block spec over the case contract, with an overridable binding. */
const oneBlock = (binding: unknown) => ({
  specVersion: 1,
  title: "Cases",
  blocks: [
    {
      id: "blk_a",
      type: "CasesTable",
      frame: { x: 0, y: 0, w: 12, h: 6 },
      config: { title: "Cases" },
      binding,
    },
  ],
});

describe("gatePlan — two-phase Phase A validator gate (card #20)", () => {
  it("BUILD: a valid plan returns the normalized spec, ready to stream", () => {
    const outcome = gatePlan(demoWorkspaces[0]!.spec, ctx);
    expect(outcome.status).toBe("build");
    if (outcome.status !== "build") return;
    expect(outcome.spec.blocks.length).toBeGreaterThan(0);
  });

  it("CLARIFY: an under-determined block yields exactly one targeted question + opaque draft", () => {
    // A CasesTable needs a rows binding; null is the one under-determination the
    // validator can prove needs a user answer.
    const plan = oneBlock(null);
    const outcome = gatePlan(plan, ctx);
    expect(outcome.status).toBe("clarify");
    if (outcome.status !== "clarify") return;
    expect(typeof outcome.question).toBe("string");
    expect(outcome.question.length).toBeGreaterThan(0);
    // The draft is carried for amendment but is the raw plan, never a spec.
    expect(outcome.draft).toEqual(plan);
  });

  it("REJECT: a hallucinated field is explained in the contract's terms", () => {
    const plan = oneBlock({
      entity: "case",
      query: { filters: [{ field: "nonexistent", op: "eq", value: "x" }] },
    });
    const outcome = gatePlan(plan, ctx);
    expect(outcome.status).toBe("reject");
    if (outcome.status !== "reject") return;
    expect(outcome.explanation).toMatch(/nonexistent/);
    // References the contract — the allowed fields appear in the fix text.
    expect(outcome.explanation).toMatch(/risk|analyst|status/);
    expect(outcome.errors.length).toBeGreaterThan(0);
  });

  it("REJECT: an unknown entity names the contracted entities", () => {
    const plan = oneBlock({ entity: "invoice", query: { filters: [] } });
    const outcome = gatePlan(plan, ctx);
    expect(outcome.status).toBe("reject");
    if (outcome.status !== "reject") return;
    expect(outcome.explanation).toMatch(/case/);
  });

  it("plan gate is well within the <2s budget (it is pure + synchronous)", () => {
    const plan = demoWorkspaces[0]!.spec;
    const start = performance.now();
    for (let i = 0; i < 100; i++) gatePlan(plan, ctx);
    const perCall = (performance.now() - start) / 100;
    // The model's generation is the only slow part; the gate itself is ~free.
    expect(perCall).toBeLessThan(50);
  });
});
