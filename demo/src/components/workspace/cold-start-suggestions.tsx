"use client";

/**
 * Cold-start suggestion chips (card #46).
 *
 * Shown only when the thread is empty — the moment Sarah is staring at a blank
 * input. Chips are seeded by `suggestionsFor` (vendor-curated-per-role first,
 * then contract-derived) and each click SENDS its prompt through the normal
 * generation path, so a suggestion is just a pre-typed message — it still hits
 * the validation gate like anything else. Impressions and clicks feed
 * `trackSuggestion` for the vendor's click-through analytics.
 *
 * Sending: we can't call `submit()` right after `setValue()` because the input
 * value lives in context and updates on the next render. So we stash the pending
 * prompt in a ref, set the value, and submit from an effect once the context
 * value has caught up — robust regardless of whether `submit` reads a ref or a
 * closed-over value.
 */
import { useTambo, useTamboThreadInput } from "@tambo-ai/react";
import { useEffect, useMemo, useRef } from "react";
import { Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EntityContract } from "@workspace-engine/core";
import { suggestionsFor, type CuratedSuggestions, type Suggestion } from "@/workspace-engine/suggestions";
import { suggestionStats, trackSuggestion } from "@/workspace-engine/suggestion-analytics";

export interface ColdStartSuggestionsProps {
  contracts: readonly EntityContract[];
  role?: string;
  curated?: CuratedSuggestions;
  max?: number;
  className?: string;
}

export function ColdStartSuggestions({
  contracts,
  role,
  curated,
  max,
  className,
}: ColdStartSuggestionsProps) {
  const { messages, isStreaming } = useTambo();
  const { value, setValue, submit } = useTamboThreadInput();
  const pending = useRef<Suggestion | null>(null);

  const suggestions = useMemo(
    () => suggestionsFor(contracts, { role, curated, max }),
    [contracts, role, curated, max],
  );

  // Live-inspection hook (matches the __we* eval hooks): read click-through
  // stats from the browser console. Guarded so it's dev-only.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __weSuggestionStats?: typeof suggestionStats }).__weSuggestionStats =
      suggestionStats;
  }, []);

  // Cold start = no messages yet and nothing streaming in.
  const isColdStart = messages.length === 0 && !isStreaming;

  // One impression per chip per cold-start appearance.
  useEffect(() => {
    if (!isColdStart) return;
    for (const s of suggestions) {
      trackSuggestion({ type: "impression", id: s.id, prompt: s.prompt, role, source: s.source });
    }
  }, [isColdStart, suggestions, role]);

  // Submit once the context value has caught up to the chosen prompt.
  useEffect(() => {
    const s = pending.current;
    if (s && value === s.prompt) {
      pending.current = null;
      void submit().catch((err) => console.error("Suggestion submit failed:", err));
    }
  }, [value, submit]);

  if (!isColdStart || suggestions.length === 0) return null;

  const send = (s: Suggestion) => {
    trackSuggestion({ type: "click", id: s.id, prompt: s.prompt, role, source: s.source });
    pending.current = s;
    setValue(s.prompt);
  };

  return (
    <div className={cn("px-4 pt-10 pb-4 max-w-4xl mx-auto w-full", className)}>
      {/* Product empty-state hero (#78): the chips are the hero — a short,
          domain-appropriate header/subhead frames them instead of the
          template's generic "Not sure where to start?" line. */}
      <h1 className="font-sentient text-2xl tracking-tight text-foreground sm:text-3xl">
        Describe the workspace you need
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Ask in plain language — it&apos;s validated against your data contracts,
        then rendered live. Try one of these to start:
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => send(s)}
            title={s.prompt}
            className={cn(
              "inline-flex items-center gap-1.5 py-2 px-3 rounded-2xl text-sm",
              "border border-border transition-colors duration-150 hover:border-primary hover:bg-secondary",
              s.source === "curated" && "bg-secondary/60",
            )}
          >
            {s.source === "curated" && <Pin className="h-3 w-3 text-primary" aria-hidden />}
            <span className="font-medium">{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
