---
tags: [log, phase3, implementer]
created: 2026-07-10
---

# Phase 3 #21 — spec lifting: save a generated workspace, reload it identical

Implementer session. Built #21 after clearing the P1 gate. Commit `b576a86`,
In Progress. All in `demo/`. This closes the Phase 3 DoD loop:
**sentence → validated spec → renders → saves → reloads live.**

## Architecture decision

The card assumed a tree of individual interactable blocks lifted via `accepts{}`
props→spec reversal. But #20/#70 made the model emit the canonical WorkspaceSpec
DIRECTLY (rendered via GeneratedWorkspace), so there is nothing to reverse-
engineer — lifting = capture the live workspace's already-validated spec and
persist it. Building the `accepts{}` reversal would have meant re-introducing the
individual-block streaming flow #20 deliberately moved away from (and which had
the parse-failure/grounding problems). Same acceptance criteria, fit to the
current pipeline. (User said "decide yourself"; this was the analysis.)

## What shipped

- `lift.ts` — `liftWorkspaceSpec(snapshot, ctx)`: find the GeneratedWorkspace in
  `useCurrentInteractablesSnapshot()`, re-gate its spec (must be BUILD) before
  persisting (criterion 1). Unliftable → `LiftError` naming the reason: nothing
  generated / still composing / the contract explanation (criterion 3). 6 tests.
- `interactable-workspace.ts` — wraps GeneratedWorkspace with
  `withTamboInteractable` so each render lands in the snapshot. SEPARATE file:
  importing `@tambo-ai/react` into the pure component pulls voice/media deps that
  call `URL.createObjectURL` at module load and break the jsdom unit test.
- `workspace-store.ts` — a localStorage-backed WorkspaceStore (the SDK's port),
  so saves survive a full page reload. 3 tests incl. fresh-instance reload.
- `save-bar.tsx` on /create; `/saved` renders the selected spec through the same
  WorkspaceProvider + WorkspaceRenderer as /workspaces (criterion 2).
- `stripSpecRoot` moved into `gatePlan` so the render gate and the save gate
  normalize identically.

## Verified LIVE (headless)

flagship → rendered `ui-board` → click Save → **full page load of /saved** →
identical `ui-board`, 13 live CASE ids, 0 broken blocks, generated ≡ reloaded.
`withTamboInteractable` capture works; localStorage survives the reload.
Demo suite 26/26, tsc + lint clean (fixed a "setState synchronously in effect"
lint error by moving the load into an async IIFE + reloadKey).

## Next

- **#22 eval harness** — the scratchpad `measure.mjs` rig (fresh browser context
  per run, synchronous progress log, generated-workspace testid + parse-error
  detection) is the basis; headline metrics = first-attempt validity +
  parse-failure rate (carried from #70). Seed from
  `demo/eval/phase0-quality-log.json`.
- Then #23 clarify/reject UX, #44 devtools, #45 vendor kit, #46 cold-start,
  #47 red-team, #32 threat model.

Relates to [[trello-workspace-engine-board]], [[Review Workflow]].
