/**
 * Vendor confidence report (card #45).
 *
 * Turns a run's metrics into the sentence a vendor's security/staging reviewer
 * wants: "of 24 prompts, 92% produced a valid workspace, 3 correctly refused,
 * 0 built something unsupported." Reuses the #22 metrics engine so the vendor
 * number and our internal gate are the exact same computation.
 */
import {
  checkThresholds,
  computeMetrics,
  pct,
  type CaseRun,
  type Metrics,
  type Thresholds,
  DEFAULT_THRESHOLDS,
} from "../metrics";

export interface VendorReport {
  metrics: Metrics;
  pass: boolean;
  violations: string[];
  summary: string;
}

export function vendorReport(
  runs: readonly CaseRun[],
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): VendorReport {
  const metrics = computeMetrics(runs);
  const { pass, violations } = checkThresholds(metrics, thresholds);
  const c = metrics.counts;
  const refused = c.refuseExpected; // reject + adversarial expected
  const refusedOk = refused - c.falseBuilds;

  const summary = [
    `Workspace generation eval — ${metrics.total} prompt(s) against your contracts`,
    ``,
    `  valid workspaces   ${pct(metrics.validSpecRate)}  (${c.builtValid}/${c.buildMeasured})`,
    `  correctly refused  ${refusedOk}/${refused}   (out-of-contract asks)`,
    `  clarified          ${c.clarifiedOk}/${c.clarifyExpected}`,
    `  false-build        ${pct(metrics.falseBuildRate)}  (${c.falseBuilds})   ← must be 0`,
    `  parse failures     ${pct(metrics.parseFailureRate)}`,
    c.infraTimeouts ? `  (skipped ${c.infraTimeouts} infra timeout(s))` : ``,
    ``,
    pass ? `  ✓ PASS — ready to ship` : `  ✗ FAIL — ${violations.join("; ")}`,
  ]
    .filter((l) => l !== undefined)
    .join("\n");

  return { metrics, pass, violations, summary };
}
