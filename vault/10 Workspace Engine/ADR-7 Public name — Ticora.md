---
tags: [decision]
created: 2026-07-19
updated: 2026-07-19
---

# ADR-7 · Public name — **Ticora** #decision

**Status:** accepted 2026-07-19 — founder finalized the name as **Ticora**.
Legal copy (LICENSE/NOTICE, ToS, privacy) has been swept: `{{PRODUCT_NAME}}`
→ "Ticora" everywhere. `{{LEGAL_ENTITY}}` stays a placeholder until an
entity is incorporated.

## Context

Phase 6 card #106: the internal working name ("Canis", used in demo/brand
surfaces) was searched and found domain-poor at the top level (see
"Canis search evidence" below, kept for the record). The founder decided to
go with a different name, **Ticora**, rather than fight for a compound
Canis domain.

## Search evidence for "Ticora" (2026-07-19)

- **Trademark:** no software/tech company or live USPTO mark found for
  "Ticora" — the only notable hit is an unrelated individual (a trademark
  attorney) named Ticora Davis, not a mark on the word itself. Knock-out
  search only, not a professional clearance; still recommended before
  heavy brand spend or launch publicity.
- **npm:** bare package `ticora` and scope `@ticora` are both unclaimed
  (404 on the registry).
- **Domains (NS lookup):** `ticora.com`, `ticora.dev`, `ticora.io`, and
  `ticora.ai` are all available — a clean sweep, unlike Canis.

**Net read:** materially cleaner than "Canis" on every axis checked
(trademark, npm, domains). Good decision.

## Decision

1. Public name is **Ticora**. Working title "Workspace Engine" (current npm
   scope `@workspace-engine`) is retired as the public-facing name; the
   scope rename itself is scoped to card #99 (npm publish), not this card.
2. LICENSE copyright holder: **"The Ticora Authors"**.
3. Primary domain candidate: `ticora.dev` or `ticora.com` (both available) —
   final pick is the founder's call when registering (user action below).
4. npm scope: **`@ticora`** — register when card #99 executes the rename.

## User actions (need accounts/payment — not doable by the agent)

- [ ] Register the chosen `ticora.*` domain(s)
- [ ] Create npm org `@ticora`
- [ ] Optional: professional trademark clearance before launch publicity

## Sweep status

- [x] ADR updated to accepted with rationale
- [x] Placeholders replaced in `apps/docs/content/legal/*` and package
      LICENSE/NOTICE files (`{{PRODUCT_NAME}}` → Ticora)
- [ ] Register domains + npm org under Ticora (user action, above)
- [ ] Card #99: rename npm scope `@workspace-engine` → `@ticora`
- [ ] Cards #100/#96: site + docs domains under ticora.*

## Appendix: "Canis" search evidence (superseded, kept for record)

**Trademark (US):** the only bare "CANIS" USPTO mark — serial 90196818,
Canis Ventures, Inc. — is DEAD/ABANDONED and covered air mattresses, not
software; no live class 9/42 conflict surfaced.

**Companies:** Canis Automotive Labs Ltd (CAN-bus security, automotive) was
the closest neighbor; Canis Software Inc. (Oakville, ON) had no visible
product.

**npm:** bare `canis` taken (unrelated stale package); scope `@canis` was
free.

**Domains:** every prime single-word domain (canis.com/.dev/.io/.ai/.sh)
was taken or parked for sale; only compounds (canis.tools, canishq.com,
etc.) were available — the domain-poverty that ultimately motivated
choosing Ticora instead.

Relates to [[Architecture Decisions]] (ADR-1), Phase 6 plan in
`60 Handoffs/2026-07-19 — Phase 6 Launch plan.md`.
