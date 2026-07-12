/**
 * Contract-seeded prompt generator (card #45).
 *
 * The vendor eval kit's core: given a vendor's own contracts, enumerate their
 * declared capabilities (groupable / sortable / aggregatable / string-filterable
 * fields) and emit natural-language prompts whose expected spec is derived from
 * the SAME capability — so the assertions are correct by construction, not
 * hand-authored. "Show cases grouped by analyst" is generated only because the
 * contract says `analyst` is groupable, and it asserts exactly that groupBy.
 *
 * A vendor points this at their contracts and gets a representative suite for
 * free, plus a couple of out-of-contract rejects to prove the guardrail holds.
 */
import type { EntityContract } from "@workspace-engine/core";
import type { EvalCase, Expected } from "../dataset";
import type { Expectation } from "../assert";

const humanize = (field: string) =>
  field.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ").toLowerCase();

const build = (assert: Expectation): Expected => ({ verdict: "build", assert });

const AGG_PHRASE: Record<string, (f: string) => string> = {
  sum: (f) => `Total ${f}`,
  avg: (f) => `Average ${f}`,
  max: (f) => `Highest ${f}`,
  min: (f) => `Lowest ${f}`,
};

/** Field names very unlikely to exist on a real contract — for the reject probes. */
const MISSING_FIELDS = ["region", "assigned_lawyer", "sentiment_score"];

export function generateEvalCases(
  contracts: readonly EntityContract[],
): EvalCase[] {
  const cases: EvalCase[] = [];
  let n = 0;
  const id = (kind: string) => `gen-${kind}-${++n}`;

  for (const c of contracts) {
    const e = c.name;
    const caps = c.capabilities;

    cases.push({ id: id("list"), category: "build", prompt: `List all ${e}s`,
      expected: build({ blockTypes: ["CasesTable"] }) });
    cases.push({ id: id("count"), category: "build", prompt: `How many ${e}s are there?`,
      expected: build({ blockTypes: ["KpiCards"], query: { aggregates: [{ fn: "count" }] } }) });

    for (const field of caps.groupable) {
      cases.push({ id: id("group"), category: "build",
        prompt: `Show ${e}s grouped by ${humanize(field)}`,
        expected: build({ query: { binds: e, groupBy: field } }) });
    }

    for (const [field, fns] of Object.entries(caps.aggregations)) {
      for (const fn of fns) {
        const phrase = AGG_PHRASE[fn]?.(humanize(field)) ?? `${fn} of ${humanize(field)}`;
        cases.push({ id: id(`agg-${fn}`), category: "build",
          prompt: `${phrase} across all ${e}s`,
          expected: build({ query: { aggregates: [{ fn, field }] } }) });
      }
    }

    for (const field of caps.sortable) {
      cases.push({ id: id("sort"), category: "build",
        prompt: `${e}s sorted by ${humanize(field)}`,
        expected: build({ query: { sorts: [{ field }] } }) });
    }

    // A filterable view needs a TEXT field for the FilterBar (string-kind, #69).
    const textField = [...caps.filterable].find((f) => c.fields[f] === "string");
    if (textField) {
      cases.push({ id: id("filterview"), category: "build",
        prompt: `A filterable view of ${e}s I can search by ${humanize(textField)}`,
        expected: build({ blockTypes: ["FilterBar"] }) });
    }

    // Out-of-contract rejects — the missing field IS the ask, so no substitution.
    for (const missing of MISSING_FIELDS) {
      if (missing in c.fields) continue;
      cases.push({ id: id("reject"), category: "reject",
        prompt: `Group ${e}s by ${humanize(missing)}`,
        expected: { verdict: "reject", because: `no ${missing} field on the ${e} contract` } });
    }
  }

  return cases;
}
