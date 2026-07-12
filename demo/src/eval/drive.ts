/**
 * Shared headless drive for the eval runners (#22 golden, #45 vendor kit).
 *
 * Drives one prompt on /create in a fresh browser context and classifies the
 * outcome (build / no_build / parse_failure / timeout), capturing the built spec
 * for assertions and replayable fixtures. Bounded per-op so a self-hosted-stack
 * dip can't hang the run (a page hiccup → timeout, an INFRA outcome). Kept out of
 * the test files so both runners stay identical.
 */
import type { Browser } from "playwright";
import type { WorkspaceSpec } from "@workspace-engine/core";
import { assertSpec } from "./assert";
import type { EvalCase } from "./dataset";
import type { CaseRun } from "./metrics";

export type DrivenRun = CaseRun & { builtSpec?: unknown };

export async function driveCase(
  browser: Browser,
  base: string,
  c: EvalCase,
  perPromptMs: number,
): Promise<DrivenRun> {
  const ctx = await browser.newContext(); // fresh anon userKey per prompt
  const page = await ctx.newPage();
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
    await page.goto(`${base}/create`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await page.evaluate(() =>
      (document.querySelector('.tiptap[contenteditable="true"]') as HTMLElement | null)?.focus(),
    );
    await page.keyboard.type(c.prompt);
    await page.waitForTimeout(150);
    await page.keyboard.press("Enter");
  } catch {
    loadFailed = true;
  }

  let outcomeKind: CaseRun["outcomeKind"] = loadFailed ? "timeout" : "no_build";
  const deadline = Date.now() + perPromptMs;
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
  let builtSpec: unknown;
  if (outcomeKind === "build") {
    builtSpec = await page.evaluate(
      () => (window as unknown as { __weLastSpec?: unknown }).__weLastSpec,
    );
    if (c.expected.verdict === "build") {
      const r = builtSpec
        ? assertSpec(builtSpec as WorkspaceSpec, c.expected.assert)
        : { pass: false, failures: ["built but no spec captured"] };
      assertPass = r.pass;
      assertFailures = r.failures;
    }
  }

  await ctx.close();
  return { id: c.id, category: c.category, outcomeKind, assertPass, assertFailures, builtSpec };
}
