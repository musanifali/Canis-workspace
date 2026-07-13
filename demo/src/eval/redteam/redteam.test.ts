/**
 * Red-team guarantee (card #47) — runs in the normal `npm test` / CI.
 *
 * The security promise is deterministic, so we prove it deterministically: every
 * adversarial spec in the corpus must be rejected by the gate. No model, no
 * network — a regression here fails CI like any other broken invariant. The
 * printed catch-rate is the number that goes into the threat-model collateral
 * (#32).
 */
import { describe, expect, it } from "vitest";
import { validationContext } from "@/workspace-engine/kit";
import { RED_TEAM, type RedTeamCategory } from "./dataset";
import { assessCatch, catchSummary } from "./catch";

const ALL_CATEGORIES: RedTeamCategory[] = [
  "field-exfiltration", "unknown-sort", "unknown-group", "unknown-aggregation",
  "out-of-contract-entity", "not-filterable", "not-sortable", "not-groupable",
  "disallowed-aggregation", "non-aggregatable-field", "limit-abuse", "prompt-injection",
];

describe("red-team suite — the validator catches 100% (card #47)", () => {
  const report = assessCatch(RED_TEAM, validationContext);

  it("has at least 50 adversarial prompts", () => {
    expect(RED_TEAM.length).toBeGreaterThanOrEqual(50);
  });

  it("gives every case a unique id", () => {
    const ids = RED_TEAM.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers every attack category", () => {
    for (const cat of ALL_CATEGORIES) {
      expect(RED_TEAM.some((c) => c.category === cat), `missing category ${cat}`).toBe(true);
    }
  });

  it("catches 100% — no adversarial spec would render", () => {
    console.log(catchSummary(report));
    expect(report.escaped, `${report.escaped.length} escaped: ${JSON.stringify(report.escaped)}`).toHaveLength(0);
    expect(report.catchRate).toBe(1);
  });

  it("catches every case in every category", () => {
    for (const [cat, { caught, total }] of Object.entries(report.byCategory)) {
      expect(caught, `${cat}: only ${caught}/${total} caught`).toBe(total);
    }
  });
});
