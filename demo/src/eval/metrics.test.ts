import { describe, expect, it } from "vitest";
import { checkThresholds, computeMetrics, type CaseRun } from "./metrics";

const run = (
  category: CaseRun["category"],
  outcomeKind: CaseRun["outcomeKind"],
  assertPass?: boolean,
): CaseRun => ({ id: Math.random().toString(36), category, outcomeKind, assertPass });

describe("computeMetrics + thresholds (card #22)", () => {
  it("valid-spec rate counts build-expected that built AND asserted", () => {
    const m = computeMetrics([
      run("build", "build", true),
      run("build", "build", true),
      run("build", "build", false), // built but wrong shape
      run("build", "no_build"), // refused/clarified instead of building
    ]);
    expect(m.validSpecRate).toBeCloseTo(0.5);
    expect(m.counts.builtValid).toBe(2);
  });

  it("false-build rate = refuse-expected that built (the worst failure)", () => {
    const m = computeMetrics([
      run("reject", "no_build"),
      run("reject", "build"), // <- false build
      run("adversarial", "no_build"),
    ]);
    expect(m.falseBuildRate).toBeCloseTo(1 / 3);
    expect(m.counts.falseBuilds).toBe(1);
  });

  it("false-build rate is 0 (not 1) when there are no refuse-expected cases", () => {
    const m = computeMetrics([run("build", "build", true), run("build", "no_build")]);
    expect(m.falseBuildRate).toBe(0);
    expect(checkThresholds(m).violations.join()).not.toMatch(/false-build/);
  });

  it("excludes infra timeouts from valid-spec (a stack dip isn't a quality failure)", () => {
    const m = computeMetrics([
      run("build", "build", true),
      run("build", "build", true),
      run("build", "timeout"), // stack hiccup — not counted against valid-spec
    ]);
    expect(m.validSpecRate).toBe(1); // 2/2 measured, not 2/3
    expect(m.counts.infraTimeouts).toBe(1);
    expect(m.counts.buildMeasured).toBe(2);
  });

  it("parse-failure rate spans every category", () => {
    const m = computeMetrics([
      run("build", "parse_failure"),
      run("build", "build", true),
      run("reject", "no_build"),
      run("adversarial", "parse_failure"),
    ]);
    expect(m.parseFailureRate).toBeCloseTo(0.5);
  });

  it("gate fails on any false build, even with a high valid-spec rate", () => {
    const m = computeMetrics([
      run("build", "build", true),
      run("build", "build", true),
      run("reject", "build"), // one false build
    ]);
    const { pass, violations } = checkThresholds(m);
    expect(pass).toBe(false);
    expect(violations.join()).toMatch(/false-build/);
  });

  it("gate passes when valid-spec high, no false builds, low parse failures", () => {
    const runs = [
      ...Array.from({ length: 9 }, () => run("build", "build", true)),
      run("build", "no_build"),
      run("reject", "no_build"),
    ];
    expect(checkThresholds(computeMetrics(runs)).pass).toBe(true);
  });

  describe("inconclusive runs (review P2 #74)", () => {
    it("does not vacuously pass when every case timed out (stack down)", () => {
      const runs = [run("reject", "timeout"), run("clarify", "timeout"), run("adversarial", "timeout")];
      const m = computeMetrics(runs);
      // Pre-fix, buildExpected/buildMeasured were both 0 → validSpecRate
      // vacuously 1 → this would have passed with nothing measured.
      expect(m.validSpecRate).toBe(1);
      const verdict = checkThresholds(m);
      expect(verdict.pass).toBe(false);
      expect(verdict.inconclusive).toBe(true);
      expect(verdict.violations.join()).toMatch(/inconclusive/);
    });

    it("is inconclusive, not a normal violation, below the measured-case floor", () => {
      const runs = [
        run("build", "build", true),
        run("build", "timeout"),
        run("build", "timeout"),
        run("build", "timeout"),
      ]; // 1/4 measured, below the 50% default floor
      const verdict = checkThresholds(computeMetrics(runs));
      expect(verdict.inconclusive).toBe(true);
      expect(verdict.pass).toBe(false);
    });

    it("passes normally once enough cases are measured, ignoring a minority of timeouts", () => {
      const runs = [
        ...Array.from({ length: 8 }, () => run("build", "build", true)),
        run("build", "timeout"), // 8/9 measured — comfortably over the floor
        run("reject", "no_build"),
      ];
      const verdict = checkThresholds(computeMetrics(runs));
      expect(verdict.inconclusive).toBe(false);
      expect(verdict.pass).toBe(true);
    });

    it("is inconclusive (not vacuously passing) on an empty run", () => {
      const verdict = checkThresholds(computeMetrics([]));
      expect(verdict.inconclusive).toBe(true);
      expect(verdict.pass).toBe(false);
    });
  });
});
