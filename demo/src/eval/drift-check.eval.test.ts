/**
 * Drift gate (card #47) — `npm run eval:drift`, the blocking step in the weekly
 * workflow.
 *
 * Reads the accumulated trend, runs detectDrift, and FAILS (non-zero) on a
 * regression so a model that drifts under us turns the scheduled build red — a
 * blocking alert, not a surprise. Guarded by EVAL_DRIFT=1 so it never gates a
 * normal `npm test` (which has no trend file). detectDrift's own logic is
 * unit-tested in drift-check.test.ts.
 */
import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { readTrend } from "./report";
import { detectDrift, driftSummary } from "./drift-check";

const RUN = process.env.EVAL_DRIFT === "1";
const TREND = process.env.EVAL_TREND ?? resolve(__dirname, "../../eval/trend.jsonl");

describe.skipIf(!RUN)("model-drift gate (card #47)", () => {
  it("the latest full run has not regressed", () => {
    const trend = readTrend(TREND);
    const verdict = detectDrift(trend);
    console.log(driftSummary(verdict));
    expect(verdict.regressed, verdict.reasons.join("; ")).toBe(false);
  });
});
