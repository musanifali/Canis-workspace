---
tags: [log, demo-polish, implementer]
created: 2026-07-14
---

# Demo Polish epic — all 7 tickets implemented (implementer)

Implemented the entire 🎨 Demo Polish epic in one session, FOUNDATION-first per
the [[2026-07-14 — Demo Polish implementer kickoff]] brief. All 7 cards moved to
In Progress for the reviewer. Product = **Canis** (behind a swappable constant).
Presentation/UX only — zero product-package edits (hard boundary held).

## What shipped (commit → card)

- **#82 DESIGN FOUNDATION** (`f36dae9`, `4aa9376`) — `demo/DESIGN.md` + a Canis
  token layer in `globals.css` (color/type/spacing/radius/motion + `--we-*`
  baseline) + Sentient/Geist/Geist Mono via `next/font/local`. Caught two real
  bugs: font vars were scoped to `<body>` while `:root` tokens referenced them
  (broke `--we-font-family` + `font-sans/mono` everywhere) → moved to `<html>`;
  risk-tier colors failed WCAG AA on their tints → darkened to 700-shades, all
  11 pairs ≥4.5:1 (computed, not eyeballed). Deleted the dead Tailwind v4
  `tailwind.config.ts`. **Accent decision: institutional indigo #33389E, NOT
  Tambo green** — green is the risk vocabulary here; flagged, swappable.
- **#76 Landing** (`35f1151`) — replaced the tambo-ai scaffold `page.tsx` with a
  real product landing (hero + 3 value points + 3 entry cards). Brand behind
  `src/lib/brand.ts`. Real metadata + generated favicon (`icon.tsx`), removed
  Tambo octopus/SVGs. Responsive 1440/768, no h-scroll.
- **#77 Shell + nav** (`b2c096c`) — `DemoShell` (slim top bar, aria-current
  active state, real `<Link>`s) applied via an `(app)` route-group layout;
  landing keeps its own header. Provider-agnostic (renders outside /create's
  TamboProvider); /create `h-screen`→`h-full` to fit the shell scroll frame.
- **#78 /create polish** (`86a87b7`) — `MessageThreadFull` gained 3 opt-in props
  (placeholder, showInputAffordances, showDefaultSuggestions) defaulting to
  template behavior so /chat is untouched; /create opts into focused mode
  (domain placeholder, no attach/MCP/mic, no Get-started footer). Cold-start
  chips became the Sentient empty-state hero; composing state on-token with a
  pulsing dot. Devtools toggle preserved.
- **#79 Seed + /saved** (`4fed88b`) — `seedSavedWorkspaces()` seeds the 3
  curated `/workspaces` specs through the real `WorkspaceStore.create` port
  (indistinguishable from user-saved, idempotent, deduped by title). On-token
  empty state + "Load demo examples" CTA. 5 new unit tests.
- **#80 ui-block QA** (`aa88a7c`, `a989cc2`) — reviewed all 6 blocks at 1440 vs
  the real 240-case set via a throwaway QA route. Token-only tuning
  (`--we-font-size` 13→12, `--we-pad` 8→6) so the 11-col table stops wrapping;
  zero package edits. Before/after screenshots at `demo/DESIGN-assets/qa-80/`.
- **#81 Walkthrough + RUNBOOK** (`b776639`) — `demo/RUNBOOK.md` (prereqs, ordered
  prompts, reset, per-beat talk-track) + `scripts/record-walkthrough.mts` +
  a real `.webm` driven against the LIVE stack. Asserts visible CASE-#### at
  every render. Refusal beat: model named the missing "customer sentiment
  score" field and offered valid groupings. 0 console/page/HTTP errors.

## Verification discipline

Every ticket: `npm run build && npm test` green (98 → 103 tests) before commit;
Playwright screenshots at 1440 on visual tickets; live-stack drive for #81
(backend :8261, deepseek-v4-flash, demo :3001) asserting DATA not skeletons.

## For the reviewer

Flagged residuals are all block-source (out of demo-token scope), belong on
product cards: Table wraps CASE-IDs/ISO-dates at the hyphen; KpiCards vertical
dead space; raw un-separated 6-figure numbers. The /create thread-history left
rail (green `+`) is template ThreadHistory chrome, left per the "don't disturb
the generation flow" boundary.

Relates to [[2026-07-14 — Demo Polish epic]], [[Review Workflow]],
[[Tambo design system extract]].
