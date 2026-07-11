---
tags: [log, phase3, implementer]
created: 2026-07-12
---

# Phase 3 #23 — clarify / reject UX flows (implementer)

Built #23 after the P2 #72 gate passed. Commit `6fe82cd`, In Progress. All 3
criteria met and verified live.

## Two surfaces for two paths

In the #20/#70 architecture the validator gate runs inside GeneratedWorkspace,
and the model also decides conversationally whether to build. So clarify/reject
surface in two places, and #23 makes both good:

1. **Conversational (primary)** — the model asks one question / explains the
   refusal in chat (prompt-driven, from the P2 #72 rules).
2. **Gate fallback** — `notices.tsx`: RejectNotice + ClarifyNotice, rendered by
   GeneratedWorkspace when a *rendered* spec gates to a SEMANTIC reject/clarify
   (a shape-only reject is still "composing…" mid-stream). Never a partial tree.
   Reject lists the validator's `allowed` fields as chips; clarify shows the
   question + options. @tambo-free (onPick/onRefine callbacks so the host wires
   the chat). 4 tests.

## Live evidence

- **Reject** "group cases by the assigned lawyer" → *"there isn't a 'lawyer'
  field — the closest is 'analyst', which is groupable. Were you referring to
  grouping by the assigned analyst?"* (references the missing capability + offers
  the supported one — criterion 2).
- **Clarify** "break it down" → *"Can you clarify what you'd like me to break
  down? … Status / Risk level / Category / Analyst …"* (one question + options —
  criterion 1).
- **Rephrase without losing context** — answering the clarify in the SAME thread
  built the workspace from the earlier turn (criterion 3). Ran headless + a
  visible browser for the user.

## Root-cause test-infra fix (bonus)

The render.test snapshots kept going red daily. The #71 per-test clock pin was
insufficient: `case-management.ts::isoDaysFromToday` bakes dueDate/openedDate from
`new Date()` AT MODULE LOAD, before any beforeEach runs. Fixed properly with
`demo/vitest.setup.ts` in `setupFiles` — pins Date (timers stay real) before the
module graph imports, so the whole suite is date-deterministic. Removed
render.test's now-redundant per-test pin; regenerated snapshots; stable across
runs. Demo 55 pass / 1 skipped, tsc + lint clean.

## Note for the reviewer

The gate fallback notices are hard to trigger live now (the model refuses/clarifies
conversationally rather than rendering an invalid spec), so their evidence is the
unit tests + the wiring; the conversational path is the live evidence.

## Next

- **#44 devtools panel** — inspect the current spec, every validator verdict with
  reasons, and query execution (React-Query-Devtools-style). The `window.__weLastGate`
  hook + gatePlan verdicts are a natural data source.
- Then #45 vendor kit, #46 cold-start, #47 red-team, #32 threat model.

Relates to [[trello-workspace-engine-board]], [[Review Workflow]].
