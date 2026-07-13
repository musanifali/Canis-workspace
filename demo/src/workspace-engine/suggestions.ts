/**
 * Cold-start suggestion seeding (card #46).
 *
 * Sarah opens an empty input and doesn't know what's possible — the end-user
 * cold-start is the adoption risk on the OTHER side of the marketplace from the
 * vendor's integration. This module answers "what can I ask?" from two sources,
 * merged:
 *
 *   1. DERIVED — read each contract's declared capabilities (groupable /
 *      aggregatable / sortable / string-filterable) and phrase a natural starter
 *      prompt for each. Same idea as the #45 eval generator, but shaped for a
 *      human chip (concise label + a fuller prompt to send) and capped so the
 *      strip stays scannable. A vendor gets sensible chips for free the moment a
 *      contract exists — nothing to hand-author.
 *   2. CURATED — the vendor pins a few exemplary prompts per role. These lead
 *      (people trust a curated example over a machine phrasing) and are how a
 *      vendor tunes the first impression for, say, an analyst vs. a manager.
 *
 * Pure and Tambo-free so it unit-tests without a browser.
 */
import type { EntityContract } from "@workspace-engine/core";

export interface Suggestion {
  /** Stable id — the analytics key (card #46 click-through tracking). */
  id: string;
  /** Concise chip text. */
  label: string;
  /** The full natural-language prompt sent to the model on click. */
  prompt: string;
  /** Where it came from — curated chips render with a pinned affordance. */
  source: "curated" | "derived";
}

/** A vendor's curated prompts, keyed by role. Empty roles fall back to derived. */
export type CuratedSuggestions = Record<string, ReadonlyArray<{ label: string; prompt: string }>>;

const humanize = (field: string) =>
  field.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ").toLowerCase();

const AGG_LABEL: Record<string, (f: string) => string> = {
  sum: (f) => `Total ${f}`,
  avg: (f) => `Average ${f}`,
  max: (f) => `Highest ${f}`,
  min: (f) => `Lowest ${f}`,
};

/**
 * Derive starter prompts from a contract's capabilities. One representative
 * chip per capability KIND (group / aggregate / sort / filter) plus a plain
 * list — enough to show the range without flooding the strip. Picks the first
 * declared field of each kind so the choice is deterministic and testable.
 */
export function deriveSuggestions(
  contracts: readonly EntityContract[],
): Suggestion[] {
  const out: Suggestion[] = [];
  let n = 0;
  const id = () => `sg-${++n}`;

  for (const c of contracts) {
    const e = c.name;
    const caps = c.capabilities;
    // Resolved contracts store these as Sets; spread for index / find access.
    const groupable = [...caps.groupable];
    const sortable = [...caps.sortable];
    const filterable = [...caps.filterable];

    out.push({ id: id(), source: "derived", label: `All ${e}s`, prompt: `List all ${e}s` });

    const group = groupable[0];
    if (group) {
      out.push({
        id: id(), source: "derived",
        label: `By ${humanize(group)}`,
        prompt: `Show ${e}s grouped by ${humanize(group)}`,
      });
    }

    const [aggField, aggFns] = Object.entries(caps.aggregations)[0] ?? [];
    if (aggField && aggFns?.[0]) {
      const fn = aggFns[0];
      const phrase = AGG_LABEL[fn]?.(humanize(aggField)) ?? `${fn} of ${humanize(aggField)}`;
      out.push({
        id: id(), source: "derived",
        label: phrase,
        prompt: `${phrase} across all ${e}s`,
      });
    }

    const sort = sortable[0];
    if (sort) {
      out.push({
        id: id(), source: "derived",
        label: `Top by ${humanize(sort)}`,
        prompt: `${e}s sorted by ${humanize(sort)}, highest first`,
      });
    }

    // A filterable view needs a TEXT field for the FilterBar (string-kind, #69).
    const textField = filterable.find((f) => c.fields[f] === "string");
    if (textField) {
      out.push({
        id: id(), source: "derived",
        label: `Searchable list`,
        prompt: `A filterable view of ${e}s I can search by ${humanize(textField)}`,
      });
    }
  }

  return out;
}

/**
 * The chips to show, for a given role. Curated (role-pinned) lead; derived fill
 * the rest. De-duped by prompt text (a curated chip suppresses the derived one
 * that would ask the same thing) and capped at `max` so the strip stays short.
 */
export function suggestionsFor(
  contracts: readonly EntityContract[],
  opts: { role?: string; curated?: CuratedSuggestions; max?: number } = {},
): Suggestion[] {
  const { role, curated = {}, max = 6 } = opts;

  const curatedForRole: Suggestion[] = (role ? curated[role] ?? [] : []).map((s, i) => ({
    id: `cur-${role}-${i + 1}`,
    label: s.label,
    prompt: s.prompt,
    source: "curated" as const,
  }));

  const seen = new Set(curatedForRole.map((s) => s.prompt.trim().toLowerCase()));
  const derived = deriveSuggestions(contracts).filter((s) => {
    const key = s.prompt.trim().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return [...curatedForRole, ...derived].slice(0, max);
}
