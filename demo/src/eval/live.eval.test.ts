/**
 * Live generation eval (card #22) — the CI-gated harness run.
 *
 * SKIPPED by default (normal `npm test`); runs only under `EVAL_LIVE=1`, i.e.
 * `npm run eval`, which needs the self-hosted Tambo stack and a built demo
 * server on EVAL_BASE (default :3100). It drives every golden prompt headlessly
 * (the reviewer's tiptap technique), classifies the outcome, asserts the built
 * spec with the structural DSL, computes the headline metrics, writes the report
 * + trend dashboard, and FAILS if a threshold is breached (false-build > 0,
 * valid-spec < 90%, parse-failure > 10%).
 *
 * EVAL_LIMIT caps the number of prompts (for a quick smoke of the harness).
 */
import { describe, expect, it, vi } from "vitest";
import { resolve } from "node:path";
import { GOLDEN } from "./dataset";
import { driveCase } from "./drive";
import { checkThresholds, computeMetrics, type CaseRun } from "./metrics";
import { recordRun, subsetLabel } from "./report";
import { SYSTEM_PROMPT_VERSION } from "@/workspace-engine/system-prompt";

const LIVE = process.env.EVAL_LIVE === "1";
const BASE = process.env.EVAL_BASE ?? "http://localhost:3100";
const LIMIT = process.env.EVAL_LIMIT ? Number(process.env.EVAL_LIMIT) : GOLDEN.length;
const PER_PROMPT_MS = 90_000;
const EVAL_DIR = resolve(__dirname, "../../eval");

describe.skipIf(!LIVE)("live generation eval — golden dataset (card #22)", () => {
  it(
    "meets the metric thresholds",
    async () => {
      // The runner classifies no_build by a wall-clock deadline (Date.now() <
      // deadline). vitest.setup.ts freezes Date for snapshot determinism, which
      // would make that deadline never expire → every refusal case hangs until
      // the outer timeout (review P1 #73). This suite drives a real browser over
      // real time, so restore the real clock — and CANARY it so a future freeze
      // fails fast (in ms) instead of hanging the whole run for hours.
      vi.useRealTimers();
      const canaryStart = Date.now();
      await new Promise((r) => setTimeout(r, 15));
      expect(
        Date.now(),
        "Date.now() is frozen — the deadline logic would hang (see review P1 #73)",
      ).toBeGreaterThan(canaryStart);

      // Dynamic import so a normal `npm test` never loads playwright.
      const { chromium } = await import("playwright");
      const ids = process.env.EVAL_IDS?.split(",").map((s) => s.trim());
      const cases = ids
        ? GOLDEN.filter((c) => ids.includes(c.id))
        : GOLDEN.slice(0, LIMIT);
      const browser = await chromium.launch();
      const runs: CaseRun[] = [];

      try {
        for (const c of cases) {
          const run = await driveCase(browser, BASE, c, PER_PROMPT_MS);
          runs.push(run);
          // eslint-disable-next-line no-console
          console.log(
            `${run.id} [${run.category}] → ${run.outcomeKind}${run.assertPass === false ? " ✗ " + run.assertFailures?.join("; ") : ""}`,
          );
        }
      } finally {
        await browser.close();
      }

      const metrics = computeMetrics(runs);
      recordRun(
        {
          at: new Date().toISOString(),
          promptVersion: SYSTEM_PROMPT_VERSION,
          subset: subsetLabel(cases.map((c) => c.id), GOLDEN.length),
          metrics,
          runs,
        },
        {
          reportPath: `${EVAL_DIR}/reports/last-report.json`,
          trendPath: `${EVAL_DIR}/trend.jsonl`,
          dashboardPath: `${EVAL_DIR}/trend.md`,
        },
      );

      const { pass, inconclusive, violations } = checkThresholds(metrics);
      // eslint-disable-next-line no-console
      console.log(
        "METRICS",
        JSON.stringify(metrics.counts),
        "→",
        inconclusive ? "INCONCLUSIVE" : pass ? "PASS" : "FAIL",
        violations.join("; "),
      );
      expect(pass, violations.join("; ")).toBe(true);
    },
    LIMIT * PER_PROMPT_MS + 60_000,
  );
});
