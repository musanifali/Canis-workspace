/**
 * Model-drift regression check (card #47).
 *
 * Models drift under us even when our code doesn't change — a pinned endpoint
 * can be re-tuned upstream, or a version bump can quietly degrade generation.
 * The weekly scheduled run appends a full-corpus result to `trend.jsonl`; this
 * compares the newest full run against the previous one AND against the absolute
 * thresholds, and returns a blocking verdict. Wired into CI, a regression is a
 * red build (a blocking alert), never a surprise noticed weeks later.
 *
 * Pure: give it the parsed trend, get a verdict. IO lives in the runner.
 */
import { checkThresholds, type Metrics } from "./metrics";
import type { TrendEntry } from "./report";

export interface DriftOptions {
  /** Allowed drop in valid-spec rate vs the previous full run before it's a regression. */
  validSpecTolerance?: number;
  /** Allowed rise in parse-failure rate vs the previous full run. */
  parseFailureTolerance?: number;
}

export interface DriftVerdict {
  regressed: boolean;
  reasons: string[];
  latest?: TrendEntry;
  baseline?: TrendEntry;
}

const DEFAULTS: Required<DriftOptions> = {
  validSpecTolerance: 0.05,
  parseFailureTolerance: 0.05,
};

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

/** Only full-corpus runs are comparable — a smoke subset must never trip drift. */
const isFull = (e: TrendEntry) => e.subset.startsWith("full(");

/**
 * Verdict on the most recent full run. Regression if it breaches the absolute
 * thresholds, or if it degrades beyond tolerance vs the previous full run.
 */
export function detectDrift(trend: readonly TrendEntry[], opts: DriftOptions = {}): DriftVerdict {
  const o = { ...DEFAULTS, ...opts };
  const full = trend.filter(isFull);

  if (full.length === 0) {
    return { regressed: false, reasons: ["no full-corpus run recorded yet"] };
  }

  const latest = full[full.length - 1]!;
  const reasons: string[] = [];

  // 1) Absolute floor — the same thresholds the live run gates on.
  const { pass, violations } = checkThresholds(latest.metrics);
  if (!pass) reasons.push(...violations.map((v) => `threshold: ${v}`));

  // 2) Relative regression vs the previous full run.
  const baseline = full.length >= 2 ? full[full.length - 2] : undefined;
  if (baseline) {
    const a: Metrics = baseline.metrics;
    const b: Metrics = latest.metrics;
    if (a.validSpecRate - b.validSpecRate > o.validSpecTolerance) {
      reasons.push(`valid-spec dropped ${pct(a.validSpecRate)} → ${pct(b.validSpecRate)} (> ${pct(o.validSpecTolerance)} drop)`);
    }
    if (b.parseFailureRate - a.parseFailureRate > o.parseFailureTolerance) {
      reasons.push(`parse-failure rose ${pct(a.parseFailureRate)} → ${pct(b.parseFailureRate)} (> ${pct(o.parseFailureTolerance)} rise)`);
    }
    if (b.falseBuildRate > a.falseBuildRate) {
      reasons.push(`false-build rose ${pct(a.falseBuildRate)} → ${pct(b.falseBuildRate)}`);
    }
  }

  return { regressed: reasons.length > 0, reasons, latest, baseline };
}

export function driftSummary(v: DriftVerdict): string {
  if (!v.regressed) {
    const at = v.latest ? ` (latest ${v.latest.promptVersion} @ ${v.latest.at})` : "";
    return `drift: no regression${at} ✓`;
  }
  return `drift: REGRESSION — ${v.reasons.join("; ")}`;
}
