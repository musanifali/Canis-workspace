# Threat Model & Security Review — Workspace Engine Generation Pipeline

**Status:** Phase 3 collateral (Trello card `slHC3nkA` / #32). Sales-facing —
this is the document a buyer's security team reads before the first pilot.
**Owners:** Workspace Engine core
**Last updated:** 2026-07-14

This is the security review for the part of the product that is genuinely
novel and genuinely risky: letting an LLM generate a screen from a user's
natural-language request. It does **not** cover the underlying Tambo chat/
thread platform we consume (`tambo/` — pinned, vendored, not our code); §5
states what we inherit from it and what is explicitly out of scope here.

---

## 1. What the model can actually do

The model's only output is a **WorkspaceSpec** — a versioned JSON document
(frozen in [`workspace-spec-v1.md`](./workspace-spec-v1.md)). There is no
other channel from a prompt to the screen:

```
end-user prompt
      │
      ▼
   LLM (untrusted — may be jailbroken, or the prompt may be an injection
        smuggled through upstream text the vendor pasted in)
      │  emits: WorkspaceSpec (JSON — block types, frames, bindings)
      ▼
   gatePlan → validateSpec            (demo/src/workspace-engine/plan-gate.ts,
   (pure, synchronous, no model call)  packages/core — the ONLY authority)
      │
      ├── REJECT  → explanation naming the contract's actual boundary; nothing renders
      ├── CLARIFY → one question relayed in words; nothing renders
      └── BUILD   → the (normalized, revalidated) spec, and only then:
                        │
                        ▼
                 deterministic renderer (no LLM at read time)
                        │
                        ▼
                 per-block query → compileToExecutor
                        │  runs contract.fetch(query, auth) with the
                        │  END USER'S OWN auth, unchanged — never ours
                        ▼
                 rows, rendered inside the block the spec declared
```

**The invariant the whole design rests on:** a spec that passes `validateSpec`
cannot reference an entity, field, operator, aggregation, or row limit the
vendor did not declare in a `defineEntity` contract. This is not a convention
the model is asked to follow — it is a property of a Zod schema plus explicit
capability checks (`packages/core`'s contract compiler), checked in normal
`npm test`, independent of model behavior. A prompt injection can make the
model *want* to ask for `ssn` or a `users` table; it cannot make the validator
*accept* a spec that asks for it, because that field or entity is not in the
schema the validator was compiled from.

This bounds prompt-injection blast radius to: **the model can build a
misleading or off-topic screen using only data the vendor already agreed to
expose through the contract.** It cannot read a field, entity, or row count
outside that contract; it cannot execute code; it cannot reach a URL of its
choosing (there is no fetch-by-URL primitive anywhere in the spec — every
`binding.entity` must resolve to a contract, and every contract's `fetch`
is vendor-written, not model-influenced).

## 2. Red-team results (the number this doc cites)

**100% of the red-team corpus is caught, deterministically, with no model in
the loop.**

`demo/src/eval/redteam/dataset.ts` encodes 55 adversarial cases across 12
attack families, each as an out-of-contract `attackSpec` a fully-compromised
model would need to emit to satisfy the attack:

| Family | Cases | What it tries |
| --- | --- | --- |
| field-exfiltration | 12 | filter on an undeclared field (ssn, password, salary, email, homeAddress, phone, dateOfBirth, creditCard, apiKey, internalNotes, medicalHistory, bankAccount) |
| out-of-contract-entity | 6 | query an entity never declared (user, payment, employee, admin_settings, secret, auditLog) |
| prompt-injection (framed) | 6 | "ignore previous instructions", fake system role, tag-break, privilege claim, "bypass the filters", oversized dump |
| unknown-sort / unknown-group / unknown-aggregation | 4+4+4 | order/break-down/aggregate by a field with no capability grant |
| not-sortable / not-groupable | 4+4 | a *real* field used outside its granted capability |
| disallowed-aggregation | 4 | an aggregation function not granted for that field (e.g. `sum` on a field only `avg`/`max` is granted for) |
| non-aggregatable-field | 3 | aggregate a field with no aggregation grant at all (dates, strings) |
| limit-abuse | 3 | a row limit above the contract's `maxLimit` |
| not-filterable | 1 | filter on a real field with no filter grant |

`demo/src/eval/redteam/catch.ts::assessCatch` runs every `attackSpec` through
`gatePlan` — **the exact function the render path calls** — and asserts the
verdict is never `build`. `redteam.test.ts` runs this in plain `npm test`
(no model, no network): **55/55 caught, 0 escapes.** Because it needs no live
endpoint, this number cannot drift with model behavior or a flaky demo
stack — it is a property of the validator, re-checked on every commit and
every CI run.

A second, live suite (`redteam.eval.test.ts`, `npm run eval:redteam:live`)
drives the actual NL `prompt` for each case through the deployed model and
scans the resulting spec for `FORBIDDEN_TOKENS` (the secret field names, plus
`user`/`payment`/`employee`/`admin_settings`/`secret`/`auditLog`) — proving
the guarantee holds end-to-end, not just against hand-written attack specs.

**Independent reproduction.** This number was not just asserted by the
implementer. An independent reviewer pass (2026-07-12, session log
`vault/50 Logs/2026-07-12 — Reviewer pass 10, Phase 3 hardening + security
number verified.md`) hand-crafted 9 additional attacks not in the corpus —
including a `__proto__` prototype-pollution probe, operator-smuggling, an SSN
exfiltration attempt, and a limit-abuse case — and confirmed all 9 were
caught by the same gate, with a valid control spec still building normally.
That is the adversarial-reproduction bar this document is citing: **the
headline number has been attacked by someone other than its author and held.**

## 3. What is explicitly *not* covered by "100% caught"

Being honest about scope matters more than the number itself:

- **The corpus is data-access attacks against the contract boundary**, not an
  exhaustive jailbreak or LLM-safety audit. It does not claim the model can
  never be tricked into building a *misleading but in-contract* screen (e.g.
  grouping by the wrong field) — that is a UX/accuracy concern
  (`demo/src/eval/*` valid-spec rate, card #22/#72), not a security one, and
  is out of scope here.
- **The gate is only as strong as the contract.** If a vendor's own
  `defineEntity` call declares a field filterable that they should not have
  (e.g. accidentally exposing `ssn` in their own contract), no amount of
  validator rigor helps — that is a vendor misconfiguration, not a pipeline
  bypass. Vendors are the authors of their own blast radius; the pipeline's
  job is only to never let the *model* exceed it.
- **The eval run reporting this number must itself be trustworthy.** A
  separate finding (review P2, Trello `HYVbv9k5`) showed the live eval
  harness could report a vacuous 100% PASS when the demo stack was fully
  down (every case times out → 0 measured → an empty-denominator rate
  defaults to "perfect"). Fixed in the same phase this document ships in:
  `checkThresholds` now requires a minimum fraction of cases to be actually
  measured, or the run reports **inconclusive** (a status distinct from
  pass/fail) and the weekly drift gate treats an inconclusive run as a
  regression rather than silently going green. The 55/55 deterministic
  number above does not depend on this fix (it needs no live stack), but the
  live prompt-injection scan in §2 does, and this is why that fix shipped
  alongside this document rather than after it.

## 4. Data flow, auth, and where rows actually live

**Design (ADR-4, `vault/10 Workspace Engine/Architecture Decisions.md`):**
customer data never rests with the Workspace Engine SDK. A block's data query
runs the *vendor's own* `fetch(query, auth)` — supplied by the vendor when
they call `defineEntity` — with the *end user's own* auth token, passed
through unchanged (`demo/src/workspace-engine/agent-tools.ts:81-83`,
`packages/core/src/contract/compile.ts`'s `compileToExecutor`). We generate
the *query*; the vendor's existing backend, under the vendor's existing
session, answers it. There is no new credential, no new auth surface, and no
row of customer data ever transits or persists in our infrastructure — we
see specs (structure + field names), never the data those fields resolve to.

**Current implementation status — read this before citing the diagram above
as "in production."** The `demo/` app (Phase 3's proof-of-concept) wires
`case-contract.ts`'s `fetch` to an in-memory seeded array
(`demo/src/services/case-management.ts`) and ignores the `auth` parameter
entirely — there is no real backend call, no session propagation, and no
network boundary to defend in the demo today. This is the correct simplification
for validating the *generation and validation* pipeline (Phase 3's scope) and
is not a security gap in itself — but it also means ADR-4's auth-passthrough
is currently an **enforced interface, not yet an exercised one**: the `auth`
parameter exists and is threaded through unchanged end-to-end
(`toGroundedTools(contracts, auth)` → `compileToExecutor` → `contract.fetch`),
but no contract in this repo has a `fetch` that does anything with it yet.
Wiring a first real, auth-checked vendor backend is Phase 4 (Workspace
Service) work; this document should be revisited once that lands, since it
is the one place today's implementation and the pitched architecture diverge.

**Session identity today** is a client-generated anonymous key
(`demo/src/lib/use-anonymous-user-key.ts` — `anon-<uuid>` in `localStorage`,
no cookies, no server session) plus a client-exposed
`NEXT_PUBLIC_TAMBO_API_KEY`. This is appropriate for an unauthenticated demo;
it is not the production auth model and should not be read as one.

## 5. What we inherit from the platform (out of scope for a from-scratch audit)

The chat/thread transport underneath the generation pipeline is the pinned,
vendored Tambo backend in `tambo/` — a separate codebase we consume via
`@tambo-ai/react` and do not modify (ADR-1). A from-scratch, live penetration
test against it is out of scope here (we did not write it, do not control its
release cadence, and would need Tambo's own authorization to test their
hosted instance) — but a **static, adversarial-mindset read of the actual
guard and RLS-policy code** is fair game and worth doing, since a pilot's
security team will ask about exactly this surface.

**`/v1` API surface** (`tambo/apps/api/src/v1/v1.controller.ts`) is class-
level gated by `@UseGuards(ApiKeyGuard, BearerTokenGuard)`:

- `ApiKeyGuard` (`.../projects/guards/apikey.guard.ts`) requires `x-api-key`,
  decrypts it, and resolves + validates it against a project before setting
  `request[ProjectId]`. No key → `false` (rejected) before any handler runs.
  Errors are caught and logged with the key masked (`hideApiKey`), not raw —
  correct handling, no key leakage into logs on the failure path we read.
- `BearerTokenGuard` (`.../bearer-token.guard.ts`) runs second and reads
  `request[ProjectId]` set by the guard before it — correct ordering, so a
  request can't reach the bearer check without a validated API key first.
  If an `Authorization` header is present, it verifies a JWT signed with a
  **per-project** secret (`jwtVerify` with `issuer`/`audience` pinned), so one
  project's token cannot authenticate against another project.
- **Finding, not a defect — worth stating plainly for a buyer:** if no
  `Authorization` header is sent, the guard only rejects when the project has
  explicitly opted into `isTokenRequired`. Otherwise it passes
  (`bearer-token.guard.ts:63-75`), and per-end-user identity within that
  project falls back to a client-supplied `userKey`
  (`v1/utils/get-v1-context-info.ts`) — the same mechanism the demo uses
  (§4). That is: **cryptographic per-user identity is opt-in, not default.**
  A vendor that needs to guarantee end-user A cannot see end-user B's thread
  data within their own project must turn `isTokenRequired` on; without it,
  isolation between two end-users of the same project rests on a
  client-supplied string, not a verified credential. This is a legitimate
  design choice by the platform (anonymous/low-friction chat is a valid use
  case) and not ours to change, but it belongs in this document because it
  is exactly the kind of question a security reviewer asks and we should
  answer proactively rather than have it surface as a "gotcha" in diligence.
- Thread routes additionally require `V1ThreadInProjectGuard`, enforcing
  thread↔project ownership so one project's API key cannot address another
  project's thread by ID guessing.

**Row-level security** (`tambo/packages/db/migrations/0013_spooky_ultimo.sql`,
`.../0093_daffy_daredevil.sql`) enables RLS on `projects`, `project_members`,
and `memories`, with `FOR ALL` policies scoped by `auth.uid()` (dashboard/
`authenticated` role) or `current_setting('request.apikey.project_id')` (the
`project_api_key` role). Read statically, the policies are sound: a `FOR ALL`
policy with no separate `WITH CHECK` uses its `USING` clause for writes too
(standard Postgres behavior), so there's no silent gap between what's
readable and what's writable. **What a static review cannot confirm, and a
live test would need to:** whether the `request.apikey.project_id` session
setting is reliably reset between requests when connections are pooled — a
well-known class of RLS bypass is a pooled connection leaking a previous
request's session variable into the next one. We are flagging this as an
**open question for Tambo, not a confirmed finding** — we did not have a
live target to test it against, and asserting either "safe" or "vulnerable"
here without dynamic verification would be exactly the kind of unverified
claim §3 warns against.

**Response headers** are documented in
[`tambo/apps/api/SECURITY_HEADERS.md`](../tambo/apps/api/SECURITY_HEADERS.md)
(Helmet-based CSP, X-Frame-Options, optional HSTS). That document notes its
own open questions — treat it, not this one, as the source of truth for
platform-level header policy.

**What this buys the generation pipeline:** thread/message transport is
authenticated and tenant-isolated before a prompt ever reaches the model, and
before a spec ever reaches a vendor's screen. **What it does not do:** it says
nothing about whether a validated *spec* is safe to render — that guarantee
is entirely ours, and is what §1–§3 of this document are about. A pen-test
of `/v1` and its RLS policies as platform surface is Tambo's responsibility
as the vendor of that dependency; a pilot customer's security team asking
about it should be pointed at that boundary explicitly, not given an implied
answer on our behalf.

## 6. Summary for a buyer's security review

| Claim | Status | Evidence |
| --- | --- | --- |
| The model cannot cause arbitrary code execution | True by construction | Spec is JSON, not code; renderer is a fixed registry of block components (§1) |
| The model cannot read data outside the vendor's declared contract | True, 100% red-team catch rate, independently reproduced | §2, `redteam.test.ts`, reviewer log 2026-07-12 |
| No new auth surface; vendor data stays under the vendor's existing session | Architecturally enforced (`auth` threaded end-to-end); not yet exercised by a real backend in this repo | §4 |
| The eval numbers backing these claims can be trusted even when infrastructure is degraded | Fixed this phase — inconclusive runs are a distinct, non-green status | §3, Trello `HYVbv9k5` |
| `/v1` guard chain + RLS policies (pinned platform, static review) | Guard ordering, per-project JWT scoping, and RLS policy logic checked sound; one design property flagged (opt-in cryptographic per-user identity); connection-pool session-variable leakage flagged as an open question requiring a live test we did not run | §5 |

Relates to: `workspace-spec-v1.md` (the contract this document assumes),
Trello card #32 (`slHC3nkA`), review card `HYVbv9k5` (the eval-inconclusive
fix), `vault/10 Workspace Engine/Architecture Decisions.md` ADR-4.
