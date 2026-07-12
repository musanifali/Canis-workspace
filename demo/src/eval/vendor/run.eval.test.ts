/**
 * Vendor eval kit runner (card #45) — `npm run eval:vendor`.
 *
 * Generates a prompt suite from the vendor's OWN contracts, drives each against
 * the live app, scores a confidence report, and writes any failures as replayable
 * fixtures. Exits non-zero on a threshold breach so it drops straight into a
 * vendor's CI. Skipped unless EVAL_VENDOR=1; needs a built demo server on
 * EVAL_BASE + the model stack. EVAL_LIMIT caps the suite for a smoke.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { contracts } from "@/workspace-engine/kit";
import { generateEvalCases } from "./generate";
import { vendorReport } from "./report";
import { collectFailures } from "./fixtures";
import { driveCase, type DrivenRun } from "../drive";

const LIVE = process.env.EVAL_VENDOR === "1";
const BASE = process.env.EVAL_BASE ?? "http://localhost:3100";
const PER_PROMPT_MS = 90_000;
const LIMIT = process.env.EVAL_LIMIT ? Number(process.env.EVAL_LIMIT) : Infinity;
const FIXTURES = resolve(__dirname, "../../../eval/vendor-fixtures.json");

describe.skipIf(!LIVE)("vendor eval kit — contract-seeded confidence run (card #45)", () => {
  it(
    "scores the vendor's contracts and gates on thresholds",
    async () => {
      // Real clock — the deadline logic depends on it (review P1 #73).
      vi.useRealTimers();
      const t0 = Date.now();
      await new Promise((r) => setTimeout(r, 15));
      expect(Date.now(), "clock frozen — deadlines would hang (P1 #73)").toBeGreaterThan(t0);

      const { chromium } = await import("playwright");
      const cases = generateEvalCases(contracts).slice(0, LIMIT);
      const browser = await chromium.launch();
      const runs: DrivenRun[] = [];
      try {
        for (const c of cases) {
          const run = await driveCase(browser, BASE, c, PER_PROMPT_MS);
          runs.push(run);
          // eslint-disable-next-line no-console
          console.log(`${run.id} [${run.category}] "${c.prompt}" → ${run.outcomeKind}${run.assertPass === false ? " ✗" : ""}`);
        }
      } finally {
        await browser.close();
      }

      const report = vendorReport(runs);
      // eslint-disable-next-line no-console
      console.log("\n" + report.summary + "\n");

      const failures = collectFailures(cases, runs);
      if (failures.length > 0) {
        mkdirSync(dirname(FIXTURES), { recursive: true });
        writeFileSync(
          FIXTURES,
          JSON.stringify({ at: new Date().toISOString(), report: report.metrics.counts, failures }, null, 2),
        );
        // eslint-disable-next-line no-console
        console.log(`↳ ${failures.length} failing case(s) dumped to eval/vendor-fixtures.json for replay`);
      }

      expect(report.pass, report.violations.join("; ")).toBe(true);
    },
    LIMIT === Infinity ? 40 * 60_000 : LIMIT * PER_PROMPT_MS + 60_000,
  );
});
