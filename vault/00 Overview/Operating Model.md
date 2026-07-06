---
tags: [moc, process]
created: 2026-07-04
---

# Operating Model — where truth lives

Project state exists in four stores. **Each has exactly one job**; cross-link, never copy. Duplicated state drifts, and a stale doc is worse than no doc.

| Store | Its one job | Never put here |
|---|---|---|
| **Trello board** ([[External Links\|link]]) | What to do: tasks, priorities, acceptance criteria, review sign-offs. The only source of truth for work state. | Design rationale (it gets buried in card comments) |
| **This vault** | Why: [[Decision Note\|decision notes]], product thinking, research, [[Session Log\|session logs]]. Things worth rereading in 6 months. | Live task status, mirrored code docs |
| **Agent memory** (`~/.claude/projects/.../memory/`) | Operational pointers for Claude sessions: ports, gotchas, where things live. Small; links here instead of copying. | Anything a human needs to browse |
| **The repo** | Anything code depends on. Design docs that gate implementation (e.g. Spec v1) go in the product monorepo's `devdocs/` once it exists; the vault hosts them only as interim drafts. | — |

## Conventions for status-like notes

Notes that describe a point in time (e.g. [[Phase 0 Status]]) are **dated snapshots**, not dashboards: keep the `updated:` frontmatter honest, and link to Trello for the live state instead of re-editing tables to track it.

Notes that summarize external sources (the `30 Tambo Monorepo/` section condenses `tambo/AGENTS.md`) should stay **thin pointers with commentary** — if a fact is one `grep` away in the source, link it rather than transcribe it.

## The two-session loop

See [[Review Workflow]]. Implementer and reviewer each end their session with a note from the [[Session Log]] template in `50 Logs/`; load-bearing choices get a [[Decision Note]] in `10 Workspace Engine/`.
