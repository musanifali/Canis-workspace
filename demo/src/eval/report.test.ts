import { describe, expect, it } from "vitest";
import { renderDashboard, type TrendEntry } from "./report";
import { computeMetrics } from "./metrics";

const entry = (at: string): TrendEntry => ({
  at,
  promptVersion: "2026-07-10.7",
  metrics: computeMetrics([
    { id: "a", category: "build", outcomeKind: "build", assertPass: true },
    { id: "b", category: "reject", outcomeKind: "no_build" },
  ]),
});

describe("renderDashboard (card #22)", () => {
  it("renders a markdown table with one row per run, newest last", () => {
    const md = renderDashboard([entry("2026-07-10T00:00:00Z"), entry("2026-07-11T00:00:00Z")]);
    expect(md).toMatch(/\| Run \(UTC\) \| Prompt \| Valid-spec \|/);
    const rows = md.split("\n").filter((l) => l.includes("2026-07-1"));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain("2026-07-10T00:00:00Z");
    expect(rows[1]).toContain("2026-07-11T00:00:00Z");
    expect(rows[0]).toContain("100.0%"); // valid-spec
  });

  it("handles an empty trend", () => {
    expect(renderDashboard([])).toMatch(/metric trend/);
  });
});
