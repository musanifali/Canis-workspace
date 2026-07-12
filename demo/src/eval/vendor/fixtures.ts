/**
 * Replayable failure fixtures (card #45).
 *
 * When the vendor eval fails, the failing cases are dumped as a fixtures file so
 * the developer can replay exactly what broke — the prompt, what was expected,
 * how it actually resolved, and (when the model DID build) the captured spec, so
 * a fix can be checked without re-driving the model. A pure builder here; the
 * runner writes it to disk.
 */
import type { EvalCase } from "../dataset";
import type { CaseRun } from "../metrics";

export interface FailureFixture {
  id: string;
  prompt: string;
  category: EvalCase["category"];
  expected: EvalCase["expected"];
  outcome: CaseRun["outcomeKind"];
  assertPass?: boolean;
  assertFailures?: string[];
  /** The spec the model built (present only when it built something). */
  builtSpec?: unknown;
}

/** A run is a failure iff it didn't do what the case expected. */
export function isFailure(c: EvalCase, run: CaseRun): boolean {
  if (run.outcomeKind === "parse_failure") return true;
  if (run.outcomeKind === "timeout") return false; // infra, not a generation failure
  switch (c.expected.verdict) {
    case "build":
      return !(run.outcomeKind === "build" && run.assertPass === true);
    case "reject":
    case "clarify":
      return run.outcomeKind === "build"; // a false build / over-build
  }
}

export function collectFailures(
  cases: readonly EvalCase[],
  runs: readonly (CaseRun & { builtSpec?: unknown })[],
): FailureFixture[] {
  const byId = new Map(runs.map((r) => [r.id, r]));
  const failures: FailureFixture[] = [];
  for (const c of cases) {
    const run = byId.get(c.id);
    if (!run || !isFailure(c, run)) continue;
    failures.push({
      id: c.id,
      prompt: c.prompt,
      category: c.category,
      expected: c.expected,
      outcome: run.outcomeKind,
      assertPass: run.assertPass,
      assertFailures: run.assertFailures,
      builtSpec: run.builtSpec,
    });
  }
  return failures;
}
