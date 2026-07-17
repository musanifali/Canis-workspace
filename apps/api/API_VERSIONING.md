# API versioning & deprecation policy

Devtools die by breaking their integrators. This document is the promise the
/v1 surface makes to anyone who builds against it.

## Versioning

- The API is **versioned in the path** (`/v1/...`) from day one. The version
  segment changes only on breaking changes.
- `apps/api/openapi.json` — generated from the controllers and committed —
  is the **source of truth** for the /v1 contract. The typed client
  (`@workspace-engine/client`) is generated from it, and CI fails if the
  committed document drifts from the code.

## What counts as a breaking change

Removing or renaming a path, method, request field, or response field;
changing a field's type or meaning; tightening validation so a previously
accepted request is rejected; changing an error status code.

**Not breaking** (may ship within /v1 at any time): new endpoints, new
optional request fields, new response fields, new enum values in fields
documented as open, relaxing validation.

## Deprecation process

1. The replacement ships first — nothing is deprecated without a successor.
2. The deprecated element is marked `deprecated: true` in the OpenAPI
   document and starts returning a `Deprecation` header with a sunset date.
3. Minimum **180 days** between deprecation and removal, and removal only
   ever happens in a new path version (`/v2`), never in place.
4. `/v1` keeps working for at least **12 months** after `/v2` ships.

## Change log

Contract-affecting changes are recorded in this repo's commit history under
the `feat(api)`/`fix(api)` conventional-commit scopes; the OpenAPI document's
`info.version` bumps with them.
