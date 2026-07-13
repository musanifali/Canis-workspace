/**
 * Red-team catch assessment (card #47).
 *
 * Runs every adversarial spec through the SAME gate the render path uses
 * (`gatePlan` → `validateSpec`) and reports the catch rate. "Caught" = the gate
 * did not return a `build` — i.e. nothing would have rendered. Pure and
 * synchronous (no model, no IO), so this is a deterministic property of the
 * validator that CI enforces and the security collateral can cite verbatim.
 */
import type { ValidationContext } from "@workspace-engine/core";
import { gatePlan } from "@/workspace-engine/plan-gate";
import type { RedTeamCase, RedTeamCategory } from "./dataset";

export interface Escape {
  id: string;
  category: RedTeamCategory;
  intent: string;
}

export interface CatchReport {
  total: number;
  caught: number;
  /** caught / total — 1 is the required bar. */
  catchRate: number;
  /** Any adversarial spec the gate would have BUILT — must be empty. */
  escaped: Escape[];
  /** Per-category caught/total, for the collateral breakdown. */
  byCategory: Record<string, { caught: number; total: number }>;
}

export function assessCatch(cases: readonly RedTeamCase[], ctx: ValidationContext): CatchReport {
  const escaped: Escape[] = [];
  const byCategory: Record<string, { caught: number; total: number }> = {};

  for (const c of cases) {
    const bucket = (byCategory[c.category] ??= { caught: 0, total: 0 });
    bucket.total += 1;
    // A gate that throws on a malformed spec is still a catch (nothing renders).
    let built = false;
    try {
      built = gatePlan(c.attackSpec, ctx).status === "build";
    } catch {
      built = false;
    }
    if (built) {
      escaped.push({ id: c.id, category: c.category, intent: c.intent });
    } else {
      bucket.caught += 1;
    }
  }

  const caught = cases.length - escaped.length;
  return {
    total: cases.length,
    caught,
    catchRate: cases.length === 0 ? 1 : caught / cases.length,
    escaped,
    byCategory,
  };
}

/** One-line summary for logs / the security collateral. */
export function catchSummary(r: CatchReport): string {
  const pct = (r.catchRate * 100).toFixed(1);
  const head = `red-team: ${r.caught}/${r.total} caught (${pct}%)`;
  return r.escaped.length === 0
    ? `${head} — 100% blocked ✓`
    : `${head} — ${r.escaped.length} ESCAPED: ${r.escaped.map((e) => `${e.id}[${e.category}]`).join(", ")}`;
}
