# Paper-cut log — dogfooding the SDK (#53)

Real friction hit while building this dashboard as a vendor would. Each entry
names the fix-shaped card it should feed. Per the card: this log feeds the DX
backlog — triage entries onto the Trello board at phase planning.

## 1. The obvious integration path puts the API key in the browser

The demo (and the client's own docs comment) wires `NEXT_PUBLIC_WORKSPACE_API_KEY`
straight into `createHttpWorkspaceStore` — which ships the tenant key to every
browser. This app had to hand-roll a GET-only proxy route
([src/app/api/canis/v1/[...path]/route.ts](src/app/api/canis/v1/%5B...path%5D/route.ts))
to keep the key server-side. A vendor on Next will face exactly this on day 1.
**Feed:** #50 adapter recipes must include a same-origin proxy recipe (and the
Next guide should draw the key-handling boundary explicitly); consider shipping
a `createProxiedWorkspaceStore` helper or a documented `baseUrl`-relative
pattern in `@workspace-engine/client`.

## 2. A 404 for a missing *contract* throws `WorkspaceNotFoundError`

`client.getContract("nope")` rejects with `WorkspaceNotFoundError` (the
client's single 404 mapping) whose message says *workspace* not found — wrong
noun, confusing to catch. Renaming the class is a breaking change, so it rode
along. **Feed:** #33 release-engineering — fold a `NotFoundError` base class
(with `resource` discriminant) into the next minor; the compat suite (#51)
should pin the subclass relationship.

## 3. No public tenant/key provisioning — the "vendor signup" step is a script

Everything else in this app speaks /v1, but the tenant + API key had to come
from a repo script with owner DB access (`scripts/seed-dashboard-tenant.mjs`).
Fine for us; a real design partner can't run it. **Feed:** backlog — an
admin-scoped provisioning surface (or documented onboarding runbook) before
any external pilot.

## 4. Contract `fetch` gets the whole query but the engine re-runs it anyway

Writing the three fetches, the tempting bug is to half-honor `query` (e.g.
pass `action` filters upstream) and return pre-filtered rows the in-memory
engine then filters again — harmless, but nothing in the types says "you may
ignore `query`; the engine enforces it". The sample contract silently returns
everything. **Feed:** #30 docs — state the fetch contract explicitly
(over-fetch is safe; under-fetch is not) in the spec-format reference.

## 5. `updatedAt` epoch-millis vs ISO strings across one surface

`WorkspaceSummary.updatedAt` is epoch millis; `DataContractDto.updatedAt` and
`AuditEntryDto.createdAt` are ISO strings. Both render fine, but every
consumer writes two formatting paths. **Feed:** #33 — pick one for v1.0 and
note the migration in the deprecation policy.
