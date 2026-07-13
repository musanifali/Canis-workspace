/**
 * Suggestion click-through analytics (card #46).
 *
 * The cold-start chips are only worth seeding if the vendor can see which ones
 * actually convert — that's the third acceptance criterion ("click-through rate
 * tracked, feeds vendor analytics"). This is a tiny in-process meter: chips
 * report an `impression` when shown and a `click` when used; we keep per-chip
 * counts and derive CTR. A vendor forwards the raw events to their own analytics
 * (Segment / PostHog / a warehouse) via `setSuggestionSink` — we don't phone
 * home. Pure module state, so it unit-tests without a browser.
 */
export interface SuggestionEvent {
  type: "impression" | "click";
  /** The Suggestion.id — the join key back to what was shown. */
  id: string;
  prompt: string;
  role?: string;
  source: "curated" | "derived";
  at: number;
}

export interface SuggestionStat {
  id: string;
  impressions: number;
  clicks: number;
  /** clicks / impressions, 0 when never shown. */
  ctr: number;
}

type Counts = { impressions: number; clicks: number };

const counts = new Map<string, Counts>();
const listeners = new Set<(e: SuggestionEvent) => void>();
let sink: ((e: SuggestionEvent) => void) | null = null;

function bump(id: string, key: keyof Counts) {
  const c = counts.get(id) ?? { impressions: 0, clicks: 0 };
  c[key] += 1;
  counts.set(id, c);
}

/**
 * Record a chip impression or click. Stamps `at` if the caller omits it (keeps
 * Date.now() out of the render path), then notifies listeners + the vendor sink.
 */
export function trackSuggestion(e: Omit<SuggestionEvent, "at"> & { at?: number }): void {
  const full: SuggestionEvent = { ...e, at: e.at ?? Date.now() };
  bump(full.id, full.type === "click" ? "clicks" : "impressions");
  for (const l of listeners) l(full);
  sink?.(full);
}

/** Point suggestion events at the vendor's own analytics. `null` unsets. */
export function setSuggestionSink(fn: ((e: SuggestionEvent) => void) | null): void {
  sink = fn;
}

/** Subscribe to raw events (e.g. the devtools overlay). Returns an unsubscribe. */
export function onSuggestionEvent(fn: (e: SuggestionEvent) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Per-chip impressions / clicks / CTR, highest CTR first. */
export function suggestionStats(): SuggestionStat[] {
  return [...counts.entries()]
    .map(([id, c]) => ({
      id,
      impressions: c.impressions,
      clicks: c.clicks,
      ctr: c.impressions > 0 ? c.clicks / c.impressions : 0,
    }))
    .sort((a, b) => b.ctr - a.ctr);
}

/** Test hook — clear all counters. */
export function resetSuggestionStats(): void {
  counts.clear();
}
