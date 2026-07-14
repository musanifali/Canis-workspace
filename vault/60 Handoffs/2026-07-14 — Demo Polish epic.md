---
tags: [handoff, demo, epic]
created: 2026-07-14
---

# Demo Polish epic — make the vertical-slice demo presentation-ready

Trello list **🎨 Demo Polish** (between Phase 3 and Phase 4). Filed by the
reviewer after a live pass over the running demo, 2026-07-14.

## Why

The Phase 0–3 pipeline works and is verified (sentence → validated spec →
live screen → save/reload → grounded refusal; 92% valid, 100% injection
blocked). But the demo APP still wears the tambo-ai starter template:

- **home `/`** = raw scaffold ("tambo-ai chat template", setup checklist,
  template file list, links to /chat + /interactables). Worst offender.
- **`/create`** = works (cold-start chips, devtools, save) but carries
  leftover chrome: "Get started / Learn more / Examples" footer, mic/attach
  icons, generic placeholder, empty void before first generation.
- **`/workspaces`, `/sandbox`** = already clean.
- No shared nav → four disconnected pages; can't tell it's one product.
- `/saved` empty on a cold machine (localStorage) with no empty state.

## Hard boundary (on every child ticket)

**Presentation/UX only. Do NOT touch product packages
(@workspace-engine/core|react|ui|devtools) or the generation pipeline.** All
work is demo-local (`demo/src/app/**`, `demo/src/components/**`, demo token
overrides). A change that wants to reach into a package is a separate product
card with its own reviewer pass. The ui-block QA ticket especially: tune the
DEMO's `--we-*` token overrides, never the package source.

## Tickets (suggested order)

1. Product landing page (replace scaffold) + fix app title/favicon/meta.
2. Unified demo shell + top nav across create/workspaces/saved/sandbox.
3. Polish the /create generation surface (strip template chrome, product
   framing, empty/composing states).
4. Seed demonstrable content + /saved empty→populated.
5. Visual QA pass on the ui blocks (demo tokens only).
6. Recorded walkthrough + `demo/RUNBOOK.md` (LAST — records the polished
   result).

## Open decision for the user

Product **name + one-line positioning**. Memory says "Workspace Engine"; the
remote is "Canis-workspace". Pick one (+ tagline) before landing copy is
finalized — ticket 1 keeps the brand behind a single swappable constant so
layout work isn't blocked on it.

## Definition of done

A cold machine (stack up) + the runbook delivers the full narrative in <5 min
with nothing on screen saying "template", "scaffold", or "tambo-ai".

Relates to [[Phase 3 implementer kickoff]], [[trello-workspace-engine-board]].
