import { afterEach, describe, expect, it, vi } from "vitest";
import {
  onSuggestionEvent,
  resetSuggestionStats,
  setSuggestionSink,
  suggestionStats,
  trackSuggestion,
  type SuggestionEvent,
} from "./suggestion-analytics";

const evt = (over: Partial<SuggestionEvent>): SuggestionEvent => ({
  type: "impression",
  id: "sg-1",
  prompt: "List all cases",
  source: "derived",
  at: 0,
  ...over,
});

afterEach(() => {
  resetSuggestionStats();
  setSuggestionSink(null);
});

describe("suggestion-analytics — click-through tracking (card #46)", () => {
  it("computes CTR from impressions and clicks", () => {
    trackSuggestion(evt({ type: "impression" }));
    trackSuggestion(evt({ type: "impression" }));
    trackSuggestion(evt({ type: "impression" }));
    trackSuggestion(evt({ type: "click" }));

    const stat = suggestionStats().find((s) => s.id === "sg-1")!;
    expect(stat.impressions).toBe(3);
    expect(stat.clicks).toBe(1);
    expect(stat.ctr).toBeCloseTo(1 / 3);
  });

  it("reports CTR 0 for a chip shown but never clicked", () => {
    trackSuggestion(evt({ type: "impression" }));
    expect(suggestionStats()[0]!.ctr).toBe(0);
  });

  it("sorts stats by CTR, highest first", () => {
    trackSuggestion(evt({ id: "low", type: "impression" }));
    trackSuggestion(evt({ id: "low", type: "impression" }));
    trackSuggestion(evt({ id: "low", type: "click" }));
    trackSuggestion(evt({ id: "high", type: "impression" }));
    trackSuggestion(evt({ id: "high", type: "click" }));

    expect(suggestionStats().map((s) => s.id)).toEqual(["high", "low"]);
  });

  it("forwards raw events to the vendor sink", () => {
    const sink = vi.fn();
    setSuggestionSink(sink);
    trackSuggestion(evt({ type: "click", role: "analyst" }));
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ type: "click", role: "analyst" }));
  });

  it("notifies subscribers until unsubscribed", () => {
    const seen: string[] = [];
    const off = onSuggestionEvent((e) => seen.push(e.type));
    trackSuggestion(evt({ type: "impression" }));
    off();
    trackSuggestion(evt({ type: "click" }));
    expect(seen).toEqual(["impression"]);
  });
});
