import { describe, expect, it } from "vitest";
import { detectDrift } from "./drift-check";
import type { Metrics } from "./metrics";
import type { TrendEntry } from "./report";

const metrics = (validSpecRate: number, falseBuildRate = 0, parseFailureRate = 0): Metrics => ({
  total: 30, validSpecRate, falseBuildRate, parseFailureRate, clarifyRate: 1,
  counts: {
    buildExpected: 24, buildMeasured: 24, builtValid: Math.round(validSpecRate * 24),
    refuseExpected: 4, falseBuilds: 0, clarifyExpected: 2, clarifiedOk: 2,
    parseFailures: 0, infraTimeouts: 0,
  },
});

const entry = (over: Partial<TrendEntry> & { metrics: Metrics }): TrendEntry => ({
  at: "2026-07-14T00:00:00Z", promptVersion: "v1", subset: "full(30)", inconclusive: false, ...over,
});

describe("detectDrift (card #47)", () => {
  it("no regression when the latest full run holds vs the previous", () => {
    const v = detectDrift([entry({ metrics: metrics(0.93) }), entry({ metrics: metrics(0.94) })]);
    expect(v.regressed).toBe(false);
  });

  it("flags a valid-spec drop beyond tolerance as a regression", () => {
    const v = detectDrift([entry({ metrics: metrics(0.95) }), entry({ metrics: metrics(0.85) })]);
    expect(v.regressed).toBe(true);
    expect(v.reasons.join()).toMatch(/valid-spec dropped/);
  });

  it("flags an absolute threshold breach even without a baseline", () => {
    // A single run below the 90% floor is a regression on its own.
    const v = detectDrift([entry({ metrics: metrics(0.80) })]);
    expect(v.regressed).toBe(true);
    expect(v.reasons.join()).toMatch(/threshold:/);
  });

  it("flags any false-build appearing vs the previous run", () => {
    const v = detectDrift([entry({ metrics: metrics(0.95, 0) }), entry({ metrics: metrics(0.95, 0.25) })]);
    expect(v.regressed).toBe(true);
    expect(v.reasons.join()).toMatch(/false-build/);
  });

  it("ignores smoke subsets — only full runs are comparable", () => {
    const v = detectDrift([
      entry({ metrics: metrics(0.95) }),
      entry({ subset: "ids:p0-01 (1/30)", metrics: metrics(0.0) }), // a 1-case smoke
    ]);
    expect(v.regressed).toBe(false);
  });

  it("does not regress on an empty trend", () => {
    expect(detectDrift([]).regressed).toBe(false);
  });

  it("regresses when the only full run is inconclusive (review P2 #74)", () => {
    // A dead stack still labels itself full(N) (every case was attempted) but
    // measured almost nothing — it must never read as a clean run.
    const v = detectDrift([entry({ inconclusive: true, metrics: metrics(1) })]);
    expect(v.regressed).toBe(true);
  });

  it("ignores an inconclusive run as a baseline, even if it's the most recent", () => {
    const good = entry({ at: "2026-07-10T00:00:00Z", metrics: metrics(0.93) });
    const dead = entry({ at: "2026-07-13T00:00:00Z", inconclusive: true, metrics: metrics(1) });
    const v = detectDrift([good, dead]);
    expect(v.latest?.at).toBe("2026-07-10T00:00:00Z");
  });
});
