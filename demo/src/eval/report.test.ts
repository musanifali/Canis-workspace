import { describe, expect, it } from "vitest";
import { renderDashboard, subsetLabel, type TrendEntry } from "./report";
import { computeMetrics } from "./metrics";

const entry = (at: string, subset = "full(2)"): TrendEntry => ({
  at,
  promptVersion: "2026-07-10.7",
  subset,
  metrics: computeMetrics([
    { id: "a", category: "build", outcomeKind: "build", assertPass: true },
    { id: "b", category: "reject", outcomeKind: "no_build" },
  ]),
});

describe("renderDashboard (card #22)", () => {
  it("renders a markdown table with one row per run, newest last", () => {
    const md = renderDashboard([entry("2026-07-10T00:00:00Z"), entry("2026-07-11T00:00:00Z")]);
    expect(md).toMatch(/\| Run \(UTC\) \| Prompt \| Subset \| Valid-spec \|/);
    const rows = md.split("\n").filter((l) => l.includes("2026-07-1"));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain("2026-07-10T00:00:00Z");
    expect(rows[1]).toContain("2026-07-11T00:00:00Z");
    expect(rows[0]).toContain("100.0%"); // valid-spec
  });

  it("handles an empty trend", () => {
    expect(renderDashboard([])).toMatch(/metric trend/);
  });

  it("labels a full run vs a subset so they're not confused (P2 #72)", () => {
    expect(subsetLabel(["a", "b", "c"], 3)).toBe("full(3)");
    expect(subsetLabel(["p0-01", "rj-02"], 30)).toMatch(/^ids:p0-01,rj-02 \(2\/30\)$/);
    expect(subsetLabel(["a", "b", "c", "d", "e", "f", "g"], 30)).toMatch(/\+1 \(7\/30\)/);
  });

  it("shows the subset column in the dashboard", () => {
    const md = renderDashboard([entry("2026-07-11T00:00:00Z", "ids:p0-01 (1/30)")]);
    expect(md).toMatch(/\| Subset \|/);
    expect(md).toContain("ids:p0-01 (1/30)");
  });
});
