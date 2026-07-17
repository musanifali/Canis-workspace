---
tags: [log, phase4, security]
created: 2026-07-17
---

# 2026-07-17 — Reviewer pass 13: Phase 4 Workspace Service (all 6 + ADR-4)

**Role:** reviewer ([[Review Workflow]]). Biggest review yet — a full backend
(new packages/db, apps/api, packages/client). Verified the security-critical
claims by RUNNING adversarial probes, not reading.

## Verified → Done

- **#24 schema / ops** — 52/52 db tests. Real integrity (NOT NULL head_version,
  composite FKs) — my casual forged inserts kept bouncing off it.
- **#27 immutable versions** — reproduced independently via RAW SQL as the
  service role: UPDATE/DELETE on workspace_versions → **DENIED** (hard REVOKE,
  loud permission error). Tamper-evidence a compliance buyer needs.
- **#25 RLS** — the headline, independently reproduced. My raw-SQL probe
  (bypassing the ops layer, hitting RLS directly) **8/8**: cross-tenant
  SELECT/version-enumeration blocked, fail-closed with no tenant, cross-tenant
  UPDATE→0, forged INSERT with foreign tenant_id rejected. Pooling-safe
  mechanism (SET LOCAL ROLE + txn-local set_config(...,true)) correct.
  **Answers by construction the connection-pool-leak OPEN QUESTION our own
  security review raised about Tambo.** Composite-FK gap (FK checks bypass RLS)
  found + closed. Enforcement is at the DATABASE.
- **#26 /v1 API** — 18/18 (401/404/400 + cross-process persistence e2e).
  createHttpWorkspaceStore held to the SDK WorkspaceStore port by a compile-time
  test → the localStorage→service swap is type-guaranteed. OpenAPI drift-checked.
- **#28 sharing** — owner/editor/viewer + org + team; no-view→404 (no existence
  leak), no-right→403.
- **#48 cost controls** — append-only ledger, budgets + rate limits, 429 taxonomy,
  reads unmetered (asserted).
- **ADR-4** — first real auth-checked contract fetch. HMAC-SHA256 +
  timingSafeEqual; my forge test: valid→userKey, empty/garbage/tampered/
  swapped-userKey → all null. 401 without a token. No token, no rows — genuinely
  exercised.

Counts confirmed: 52 db + 18 api + 2 client + 112 demo.

## Filed → [review][P2]

`/v1` stamps a hardcoded `SHAPE_CHECKED_VERDICT = {verdict:"BUILD"}` — validates
spec SHAPE server-side but never contract SEMANTICS (no tenant contract wired
in). **Bounded, not a hole:** render re-gates via validateSpec against the
contract + executor re-validates queries, so a bad stored spec degrades +
its query is rejected (no exfil). Real problems: (1) audit verdict is
server-UNVERIFIED — a claim the server can't back, bad for a compliance
audit-trail pitch; (2) defense-in-depth — should validate against
data_contracts at write. Honestly flagged by the implementer.

## State

**Phase 4 implemented + reviewer-verified.** The product now has durable,
multi-tenant, RLS-isolated, immutable-versioned, audited persistence behind
the same WorkspaceStore port, a versioned /v1 API, sharing, cost controls, and
a genuinely auth-checked vendor fetch. Open: the P2 (server-side contract
validation) + a live service-mode browser drive (persistence e2e already
covers it automatically). security-review.md §4 should be re-read against the
now-exercised auth path.
