/**
 * Eval metrics + thresholds (card #22).
 *
 * The headline numbers the harness gates CI on:
 *  - valid-spec rate — of build-expected prompts, how many produced a spec that
 *    both passed the validator AND satisfied the structural assertion.
 *  - false-build rate — the WORST failure: a request that should have been
 *    refused (out-of-contract / adversarial) instead rendered a workspace.
 *    Must be zero.
 *  - parse-failure rate — hard dead turns (review P1 #70's headline reliability
 *    metric); tracked across every category.
 *  - clarify rate — informational: how often an under-determined prompt did NOT
 *    over-build.
 */
import type { EvalCategory } from "./dataset";

export type OutcomeKind = "build" | "no_build" | "parse_failure" | "timeout";

export interface CaseRun {
  id: string;
  category: EvalCategory;
  outcomeKind: OutcomeKind;
  /** For a build outcome on a build-expected case: did the assertion pass? */
  assertPass?: boolean;
  assertFailures?: string[];
}

export interface Metrics {
  total: number;
  validSpecRate: number;
  falseBuildRate: number;
  parseFailureRate: number;
  clarifyRate: number;
  counts: {
    buildExpected: number;
    buildMeasured: number; // build-expected minus infra timeouts
    builtValid: number;
    refuseExpected: number; // reject + adversarial
    falseBuilds: number;
    clarifyExpected: number;
    clarifiedOk: number;
    parseFailures: number;
    infraTimeouts: number;
  };
}

/** For "higher is better" rates, an empty denominator is vacuously perfect (1). */
const rate = (num: number, denom: number) => (denom === 0 ? 1 : num / denom);
/** For "lower is better" rates (false-build), an empty denominator is 0, not 1. */
const badRate = (num: number, denom: number) => (denom === 0 ? 0 : num / denom);

export function computeMetrics(runs: readonly CaseRun[]): Metrics {
  const isRefuse = (c: EvalCategory) => c === "reject" || c === "adversarial";

  const buildExpected = runs.filter((r) => r.category === "build");
  // A "timeout" is an infra hiccup (the self-hosted stack dipped, the page never
  // loaded) — not a generation failure. Exclude it from the valid-spec rate so a
  // stack dip doesn't masquerade as a quality regression; count it separately.
  const buildMeasured = buildExpected.filter((r) => r.outcomeKind !== "timeout");
  const builtValid = buildMeasured.filter(
    (r) => r.outcomeKind === "build" && r.assertPass === true,
  ).length;
  const infraTimeouts = runs.filter((r) => r.outcomeKind === "timeout").length;

  const refuseExpected = runs.filter((r) => isRefuse(r.category));
  const falseBuilds = refuseExpected.filter((r) => r.outcomeKind === "build").length;

  const clarifyExpected = runs.filter((r) => r.category === "clarify");
  const clarifiedOk = clarifyExpected.filter((r) => r.outcomeKind === "no_build").length;

  const parseFailures = runs.filter((r) => r.outcomeKind === "parse_failure").length;

  return {
    total: runs.length,
    validSpecRate: rate(builtValid, buildMeasured.length),
    falseBuildRate: badRate(falseBuilds, refuseExpected.length),
    parseFailureRate: badRate(parseFailures, runs.length),
    clarifyRate: rate(clarifiedOk, clarifyExpected.length),
    counts: {
      buildExpected: buildExpected.length,
      buildMeasured: buildMeasured.length,
      builtValid,
      refuseExpected: refuseExpected.length,
      falseBuilds,
      clarifyExpected: clarifyExpected.length,
      clarifiedOk,
      parseFailures,
      infraTimeouts,
    },
  };
}

export interface Thresholds {
  minValidSpecRate: number;
  maxFalseBuildRate: number;
  maxParseFailureRate: number;
}

/** CI gate defaults — anchored to the P1 #70 result (100% first-attempt). */
export const DEFAULT_THRESHOLDS: Thresholds = {
  minValidSpecRate: 0.9,
  maxFalseBuildRate: 0, // the worst failure is non-negotiable
  maxParseFailureRate: 0.1,
};

export function checkThresholds(
  m: Metrics,
  t: Thresholds = DEFAULT_THRESHOLDS,
): { pass: boolean; violations: string[] } {
  const violations: string[] = [];
  if (m.validSpecRate < t.minValidSpecRate)
    violations.push(`valid-spec rate ${pct(m.validSpecRate)} < ${pct(t.minValidSpecRate)}`);
  if (m.falseBuildRate > t.maxFalseBuildRate)
    violations.push(`false-build rate ${pct(m.falseBuildRate)} > ${pct(t.maxFalseBuildRate)}`);
  if (m.parseFailureRate > t.maxParseFailureRate)
    violations.push(`parse-failure rate ${pct(m.parseFailureRate)} > ${pct(t.maxParseFailureRate)}`);
  return { pass: violations.length === 0, violations };
}

export const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
