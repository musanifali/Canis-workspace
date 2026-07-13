---
tags: [log, phase3, implementer]
created: 2026-07-13
---

# Phase 3 #46 — cold-start suggestion chips (implementer)

Built #46, the end-user cold-start UX. Commit `3622279`, In Progress.

## The problem it solves

The vendor cold-start (integration) was #16/#45's job. #46 is the OTHER side:
Sarah opens `/create`, sees an empty input, and doesn't know what she can ask.
Empty-input abandonment is the adoption risk on the end-user side of the
marketplace. Fill the blank with clickable starter chips.

## What shipped (demo/)

- **workspace-engine/suggestions.ts** — `deriveSuggestions(contracts)`: reads
  each contract's capabilities (groupable / aggregatable / sortable /
  string-filterable) and phrases ONE natural chip per kind + a plain list.
  Deterministic (first field of each kind) so it's testable. Same
  correct-by-construction idea as #45's eval generator, shaped for a human chip
  (concise `label` + fuller `prompt`). `suggestionsFor(contracts, {role, curated,
  max})` merges curated-for-role FIRST, then derived, deduped by prompt text,
  capped. Pure + Tambo-free.
- **workspace-engine/kit.ts** — `curatedSuggestions: CuratedSuggestions`, the
  vendor's per-role pinned prompts (analyst → triage, manager → rollups). This
  is the "vendor can pin per role" criterion, living on the vendor integration
  surface. Curated prompts still flow through the same generation + validation
  gate — curation shapes the suggestion, never the output.
- **workspace-engine/suggestion-analytics.ts** — in-process CTR meter.
  `trackSuggestion({type:'impression'|'click', id, prompt, role, source})` keeps
  per-chip impressions/clicks → `suggestionStats()` (ctr, sorted). `setSuggestionSink`
  forwards raw events to the vendor's own analytics (we don't phone home);
  `onSuggestionEvent` for subscribers. `at` is stamped inside track (keeps
  Date.now() out of the render path — the react-hooks/purity lint rule).
- **components/workspace/cold-start-suggestions.tsx** — the strip. `useTambo()`
  → `messages.length === 0 && !isStreaming` gates cold-start visibility (self-hides
  once the thread has a message). Impression per chip on show. Click → track +
  send. `window.__weSuggestionStats` dev hook (mirrors the `__we*` eval hooks).
- **app/create/page.tsx** — renders the strip between the save bar and the
  thread; role from `?role=` via a lazy SSR-safe `useState` initializer (default
  "analyst"; avoids useSearchParams forcing a client-render, and avoids
  set-state-in-effect).

## The send trick

Can't `submit()` right after `setValue()` — the thread input value lives in
context and updates next render. So: stash the chosen Suggestion in a ref, call
`setValue(prompt)`, and a `useEffect([value])` fires `submit()` once the context
value has caught up. Robust whether `submit` reads a ref or a closed-over value.
A suggestion is then just a pre-typed message — no gate bypass.

## Verified LIVE (Playwright, headed screenshot)

- 6 chips render: pinned curated "My queue today" / "Overdue cases" lead, then
  derived "All cases / By risk / Average risk score / Top by risk score".
- `?role=manager` swaps the curated lead to "Exposure by category / Risk overview".
- 6 impressions on show; click "My queue today" → clicks=1, **ctr=1**; prompt
  "High-risk cases due this week" lands in the thread; chips hide.
- 17 new tests (suggestions 8, analytics 6, component 4). Demo 80 pass / 2 skip;
  tsc + lint clean.

## Gotcha

`defineEntity` resolves `filterable/sortable/groupable` to `ReadonlySet`
(aggregations stays a Record). First cut used `[0]` / `.find` and blew up at
runtime — spread the Sets first. Same lesson #45's generator already learned;
worth a memory note so #47 doesn't repeat it.

## Next

- **#47** — eval hygiene: red-team suite + scheduled model-drift re-runs.
- Then **#32** threat model + security review (last Phase 3 card).

Relates to [[trello-workspace-engine-board]], [[Review Workflow]],
[[phase3-generation]].
