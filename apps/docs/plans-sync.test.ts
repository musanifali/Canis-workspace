/**
 * The "Plans & limits" page (#94) must state the SAME caps the service
 * enforces. This reads the marked table out of the mdx and asserts every cell
 * against core's PLAN_CAPS — the page can't silently drift from the config.
 */
import { PLAN_CAPS, PLAN_LABELS, type Plan } from "@workspace-engine/core";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const num = (n: number | null) => (n === null ? "Unlimited" : String(n));
const days = (n: number | null) => (n === null ? "Unlimited" : `${n} days`);

describe("reference/plans.md ↔ PLAN_CAPS", () => {
  const source = readFileSync(
    join(__dirname, "content/reference/plans.md"),
    "utf8",
  );
  const table = source.slice(
    source.indexOf("<!-- plans:table:start -->"),
    source.indexOf("<!-- plans:table:end -->"),
  );

  it("has a row per plan with the exact caps from the config", () => {
    expect(table).not.toBe("");
    for (const plan of ["free", "pro", "internal"] as Plan[]) {
      const caps = PLAN_CAPS[plan];
      const expectedRow = `| ${PLAN_LABELS[plan]} | ${num(caps.generationsPerMonth)} | ${num(caps.maxWorkspaces)} | ${days(caps.telemetryRetentionDays)} |`;
      expect(table).toContain(expectedRow);
    }
  });
});
