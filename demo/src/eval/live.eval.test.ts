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
import { assertSpec } from "./assert";
import {
  checkThresholds,
  computeMetrics,
  type CaseRun,
  type OutcomeKind,
} from "./metrics";
import { recordRun, subsetLabel } from "./report";
import { SYSTEM_PROMPT_VERSION } from "@/workspace-engine/system-prompt";
import type { WorkspaceSpec } from "@workspace-engine/core";

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
          const ctx = await browser.newContext(); // fresh anon userKey per prompt
          const page = await ctx.newPage();
          // Bound every page op so a transient self-hosted-stack dip can't hang
          // the whole gate (a networkidle goto once stalled a full run for hours).
          page.setDefaultTimeout(30_000);
          page.setDefaultNavigationTimeout(30_000);
          let parseErr = false;
          let loadFailed = false;
          const flag = (t: string) => {
            if (t.includes("Failed to parse tool call arguments")) parseErr = true;
          };
          page.on("console", (m) => flag(m.text()));
          page.on("pageerror", (e) => flag(e.message));

          try {
            // domcontentloaded (not networkidle) — a degraded server never goes
            // idle, and we only need the page interactive, not quiescent.
            await page.goto(`${BASE}/create`, { waitUntil: "domcontentloaded" });
            await page.waitForTimeout(1500);
            await page.evaluate(() =>
              (document.querySelector('.tiptap[contenteditable="true"]') as HTMLElement | null)?.focus(),
            );
            await page.keyboard.type(c.prompt);
            await page.waitForTimeout(150);
            await page.keyboard.press("Enter");
          } catch {
            loadFailed = true; // the page/stack hiccuped — record a timeout, move on
          }

          // Classify: a rendered workspace = build; a hard parse error = the P1
          // dead turn; a page/stack hiccup = timeout (an INFRA outcome, excluded
          // from valid-spec — a stack dip isn't a generation failure); otherwise
          // it settled without building (refused/clarified) = no_build.
          let outcomeKind: OutcomeKind = loadFailed ? "timeout" : "no_build";
          const deadline = Date.now() + PER_PROMPT_MS;
          while (!loadFailed && Date.now() < deadline) {
            try {
              if (parseErr) {
                outcomeKind = "parse_failure";
                break;
              }
              if ((await page.locator("[data-testid='generated-workspace']").count()) > 0) {
                outcomeKind = "build";
                break;
              }
              await page.waitForTimeout(1500);
            } catch {
              outcomeKind = "timeout";
              break;
            }
          }

          let assertPass: boolean | undefined;
          let assertFailures: string[] | undefined;
          if (outcomeKind === "build" && c.expected.verdict === "build") {
            const spec = (await page.evaluate(
              () => (window as unknown as { __weLastSpec?: unknown }).__weLastSpec,
            )) as WorkspaceSpec | undefined;
            const r = spec
              ? assertSpec(spec, c.expected.assert)
              : { pass: false, failures: ["built but no spec captured"] };
            assertPass = r.pass;
            assertFailures = r.failures;
          }

          runs.push({ id: c.id, category: c.category, outcomeKind, assertPass, assertFailures });
          // eslint-disable-next-line no-console
          console.log(`${c.id} [${c.category}] → ${outcomeKind}${assertPass === false ? " ✗ " + assertFailures?.join("; ") : ""}`);
          await ctx.close();
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

      const { pass, violations } = checkThresholds(metrics);
      // eslint-disable-next-line no-console
      console.log("METRICS", JSON.stringify(metrics.counts), "→", pass ? "PASS" : violations.join("; "));
      expect(pass, violations.join("; ")).toBe(true);
    },
    LIMIT * PER_PROMPT_MS + 60_000,
  );
});
