---
tags: [demo, ui]
created: 2026-07-04
---

# Workspace Blocks

`demo/src/components/workspace/` — the six AI-renderable components (Phase 0 ticket #3, card `x5iutZNk`). All propsSchemas are Zod, reusing `caseSchema` from [[Case Management Service]]; state-bearing blocks use `useTamboComponentState` so the AI can read/update their state.

| Block | File | Renders |
|---|---|---|
| **CasesTable** | `cases-table.tsx` | Sortable case list; row selection via **native radio** (review fix — was div-click) |
| **KpiCards** | `kpi-cards.tsx` | Headline metric cards from `aggregateCases` output |
| **CaseQueue** | `case-queue.tsx` | Ordered work queue view |
| **FilterBar** | `filter-bar.tsx` | Interactive filter controls over the case set |
| **GroupedBoard** | `grouped-board.tsx` | Kanban-style board grouped by a case field (e.g. analyst) |
| **Graph** | `graph.tsx` (in `components/tambo/`, re-tuned) | Recharts visualization, tuned for case aggregates |

Shared visual helpers: `case-visuals.ts` (status/risk color mappings etc.).

## Design intent

Each block is a candidate **WorkspaceSpec render target** — Phase 0 lets the model pick blocks directly via `show_component_<Name>` ([[Component Registration]]); later phases put the validated spec between model and renderer ([[Architecture Decisions]] ADR-2).

## Known residual #gotcha

CasesTable radio **deselection is click-only** (no keyboard path) — logged as a non-blocker in [[Known Issues]].
