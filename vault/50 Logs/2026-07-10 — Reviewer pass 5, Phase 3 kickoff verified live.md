---
tags: [log, phase3]
created: 2026-07-10
---

# 2026-07-10 (pt5) — Reviewer pass: gate #69 + #19 verified, incl. the live moment

**Role:** reviewer ([[Review Workflow]])

## Verified → Done

- **#69 FilterBar fix (aa3e1bb)** — probe re-run: enum field REJECTs with a
  message naming the kind + text-filterable alternatives; string BUILDs. Rule
  coupled to OPS_BY_KIND (drift-proof). Spec §7 updated. e2e asserts CASE-ids
  + KPI number with reuseExistingServer:false.
- **#19 grounded agent integration (fd90b48)** — grounding-by-construction
  verified in code (one contract → tool schema + executor; hallucinated fields
  unrepresentable). Versioned prompt via context helper (right channel; pinned
  backend). **Live moment verified by reviewer**: drove /create headlessly with
  the flagship prompt → model called query_case (high+critical, July window),
  chose GroupedBoard, streamed it — 8 analyst columns, correct badges/dates.
  Screenshot: /tmp/create-drive3.png (session-local).

## Correction that matters for #22

Implementer log said the TipTap input "isn't reachable via Playwright" — it
is: `page.evaluate(() => document.querySelector('.tiptap[contenteditable]')
?.focus())` then `page.keyboard.type(...)` (Phase 0 record-demo.mts
technique). The #22 eval harness / e2e should use this; noted on the card.

## Cosmetic follow-ups (with #20)

- lib/tambo.ts component descriptions still name dead tools
  (searchCases/aggregateCases) in prose.
- Suggestions strip renders literal "Placeholder" chips on /create.

## State

Phase 3 foundation is real: **sentence → grounded tool call → streamed
component**, live, zero console errors. Next: #20 two-phase generation
(plan → validateSpec → stream) — the step that turns this from "renders a
component" into "authors a validated WorkspaceSpec".
