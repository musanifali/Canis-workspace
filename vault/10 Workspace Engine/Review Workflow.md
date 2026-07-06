---
tags: [product, process]
created: 2026-07-04
---

# Review Workflow

Two independent Claude Code sessions per phase:

- **Implementer session** — works tickets from the Trello board, top of the current phase list first.
- **Reviewer session** — independently re-verifies completed work. It must **not trust the implementer's claims**: re-run `tsc`, exercise tools with adversarial inputs, check the live stack.

## Findings → Trello cards

Reviewer files each finding as a card:

- Title prefixed `[review][P1..P3]`
- Placed at the **top of the relevant phase list** (they gate later work, e.g. eval baselines)
- Body contains: exact `file:line` references, **verified evidence** (not speculation), a suggested fix, and an acceptance-criteria checklist

## Rules

- Reviewer does **not** fix code unless asked.
- Implementer checks the top of the phase list for `[review]` cards **before** taking new tickets.
- After fixes, the reviewer re-verifies and leaves verification comments on the Done cards (this happened for all 5 fixed cards — see [[Phase 0 Status]]).

Board details in [[External Links]].
