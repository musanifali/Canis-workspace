---
tags: [log, implementer]
created: 2026-07-19
---

# 2026-07-19 · Implementer — Phase 6 kickoff, card #106 (legal foundations), partial

First Phase 6 session. Took **#106 Legal foundations** (the launch-gating
ticket per the cycle plan) to In Progress.

## Done

- **Name search for "Canis" — documented, decision PENDING** →
  [[ADR-7 Public name — Ticora]]. Founder will supply the final
  name; until then all legal/brand surfaces carry `{{PRODUCT_NAME}}`-style
  placeholders and the working title "Workspace Engine". Key facts: the only
  US CANIS mark is dead (air mattresses); Canis Automotive Labs is the
  closest live company (CAN-bus security — different market); npm scope
  `@canis` is free; prime domains taken, good compounds available
  (canis.tools, canishq.com, canis.build, usecanis.com, getcanis.dev).

## Update, same day — name finalized as "Ticora"

Founder finalized the public name: **Ticora**. [[ADR-7 Public name —
Ticora]] flipped to accepted (file renamed from "…decision pending").
Quick clearance check: no software trademark or npm conflict found for
"Ticora" (only unrelated hit is a trademark attorney's personal name);
`ticora`/`@ticora` free on npm; `ticora.com/.dev/.io/.ai` all available —
materially cleaner than Canis on every axis.

Swept `{{PRODUCT_NAME}}` → "Ticora" through:
- All six package LICENSE files + root LICENSE + NOTICE: copyright holder
  now "The Ticora Authors" (was templated `[yyyy] [name of copyright
  owner]` / "The Workspace Engine Authors").
- `apps/docs/content/legal/terms.mdx` and `privacy.mdx`: product name
  swapped in; `{{LEGAL_ENTITY}}`, `{{CONTACT_EMAIL}}`,
  `{{GOVERNING_LAW_JURISDICTION}}`, `{{SUBPROCESSOR_PAGE_URL}}` remain
  placeholders (need incorporation/founder input, not name-dependent).
- Docs rebuilt + retested: green, 10/10 content-sync tests still pass.

**Deliberately NOT touched — flagged as card #99 scope, not #106:** the
`canis` CLI binary name (`packages/cli/package.json` `bin.canis`), the
"Canis"-branded docs prose (`index.mdx` title, quickstart/guides/reference
pages), and `github.com/musanifali/Canis-workspace` URLs throughout the
docs. That's a cross-cutting rename touching runtime code and the CLI's
public command surface — bundling it into the legal card risked silent
scope creep into behavior, not just legal text. Recommend card #99 (npm
publish/rename) own the `canis` → `ticora` CLI + docs-prose sweep, and the
GitHub org/repo rename (if `musanifali/Canis-workspace` moves) get called
out explicitly there too.
- **Apache-2.0** LICENSE files in the six public packages + root, and
  `"license": "Apache-2.0"` in each package.json (db stays private,
  unlicensed).
- **Tambo attribution**: verified MIT (© 2025 Fractal Dynamics Inc.),
  consumed via npm deps + the demo patch-package patch (ADR-6) only — no
  vendored Tambo code in public packages (grep: comments only). Root
  `NOTICE` file carries the attribution.
- **ToS + privacy drafted** at `apps/docs/content/legal/{terms,privacy}.mdx`
  (Nextra nav wired). Privacy accurately mirrors
  `reference/telemetry.mdx` (opt-in, anonymous, enum-pinned, key/tenant not
  persisted) and the real `audit_log` schema in `packages/db/src/schema.ts`
  (tenant id, actor user id, action, detail JSON, timestamp; append-only,
  survives soft-delete; retained for tenant life). Docs build green,
  10/10 content-sync tests pass.
- **Cookie posture**: docs + future marketing site = zero cookies → no
  banner; dashboard = essential session cookie only (when card #93 ships).
  Note: `tambo-landing/` in the repo root is Tambo's own landing repo
  (PostHog) — not our marketing site, irrelevant to this AC.
- Trello: card #106 → In Progress, LICENSE AC checked, status comment
  posted.

## Blocked / handed to founder

- Final name (→ flip ADR-7 to accepted, sweep placeholders, register
  domains + npm org) — gates the remaining #106 ACs plus #99/#100/#96
  naming.
- Placeholders to fill on name freeze: `{{PRODUCT_NAME}}`,
  `{{LEGAL_ENTITY}}`, `{{CONTACT_EMAIL}}`, `{{GOVERNING_LAW_JURISDICTION}}`,
  `{{SUBPROCESSOR_PAGE_URL}}`.
- Recommended before launch publicity: professional trademark clearance
  (classes 9/42, US + UK/EU).

Relates to [[Phase 5 tooling decisions (proposed)]] predecessor logs and the
Phase 6 plan in `60 Handoffs/2026-07-19 — Phase 6 Launch plan.md`.
