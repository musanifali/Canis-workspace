import { describe, expect, it } from "vitest";
import type { CaseRun } from "../metrics";
import { vendorReport } from "./report";
import { collectFailures, isFailure } from "./fixtures";
import type { EvalCase } from "../dataset";

const run = (
  id: string,
  category: CaseRun["category"],
  outcomeKind: CaseRun["outcomeKind"],
  assertPass?: boolean,
): CaseRun => ({ id, category, outcomeKind, assertPass });

describe("vendorReport (card #45)", () => {
  it("scores a run into a shippable/not summary", () => {
    const r = vendorReport([
      run("a", "build", "build", true),
      run("b", "build", "build", true),
      run("c", "reject", "no_build"),
    ]);
    expect(r.pass).toBe(true);
    expect(r.summary).toMatch(/valid workspaces\s+100/);
    expect(r.summary).toMatch(/correctly refused\s+1\/1/);
    expect(r.summary).toMatch(/PASS/);
  });

  it("fails and explains when a refusal false-builds", () => {
    const r = vendorReport([
      run("a", "build", "build", true),
      run("b", "reject", "build"), // false build
    ]);
    expect(r.pass).toBe(false);
    expect(r.summary).toMatch(/false-build/);
    expect(r.violations.join()).toMatch(/false-build/);
  });
});

describe("failure fixtures (card #45)", () => {
  const cases: EvalCase[] = [
    { id: "a", category: "build", prompt: "p", expected: { verdict: "build", assert: {} } },
    { id: "b", category: "reject", prompt: "q", expected: { verdict: "reject", because: "x" } },
    { id: "c", category: "build", prompt: "r", expected: { verdict: "build", assert: {} } },
  ];

  it("classifies failures: bad build, false build, infra-timeout excluded", () => {
    expect(isFailure(cases[0]!, run("a", "build", "build", false))).toBe(true); // wrong shape
    expect(isFailure(cases[1]!, run("b", "reject", "build"))).toBe(true); // false build
    expect(isFailure(cases[2]!, run("c", "build", "timeout"))).toBe(false); // infra, not a failure
  });

  it("collects replayable fixtures with the captured spec", () => {
    const runs = [
      { ...run("a", "build", "build", false), assertFailures: ["missing groupBy"], builtSpec: { title: "A" } },
      run("b", "reject", "no_build"), // correct → not a failure
    ];
    const fx = collectFailures(cases, runs);
    expect(fx.map((f) => f.id)).toEqual(["a"]);
    expect(fx[0]!.builtSpec).toEqual({ title: "A" });
    expect(fx[0]!.assertFailures).toEqual(["missing groupBy"]);
  });
});
