# Release policy — versioning, semver, deprecation, support window

Card #33 · decision D4 (vault: Phase 5 tooling decisions). Status: active.

## What is versioned

The six **public packages** version together as one fixed group (one version
number, one changelog cadence):

| Package | Public surface |
|---|---|
| `@workspace-engine/core` | every export of `src/index.ts`: spec schemas, `parseSpec`/`serializeSpec`, `defineEntity`, contract compiler, `executeQuery`, `validateSpec`, `DEFAULT_REGISTRY` |
| `@workspace-engine/react` | provider, renderer, hooks, `WorkspaceStore` port |
| `@workspace-engine/ui` | `defaultBlocks`, block components, `--we-*` theme token names, sandbox |
| `@workspace-engine/client` | typed /v1 client, `createHttpWorkspaceStore`, error classes |
| `@workspace-engine/cli` | `canis` commands, flags, JSON output shapes, **exit codes** |
| `@workspace-engine/devtools` | devtools bus + panel API |

`db`, `api`, `dashboard`, and the demo are **private** — internal, versioned
only as dependents, never tagged. The **/v1 wire format** is governed by the
service's own OpenAPI document; a breaking /v1 change requires a major of
`@workspace-engine/client` at minimum.

## Where versions live (D4)

Packages are **changeset-versioned in-repo, not npm-published**. The semver
source of truth is the git tag `vX.Y.Z` cut by the release workflow
(`.github/workflows/release.yml`): accumulated `.changeset/*.md` files on
`main` become one `chore(release): vX.Y.Z` commit plus that tag.
"Previous minor" (compat suite, card #51) = the most recent `vX.Y.0` tag
before the current one. If the packages ever publish to a registry, the tag
flow stays; only a publish step is added.

## What "breaking" means (major bump)

- Removing/renaming any export listed above, or narrowing an accepted input
  type / widening a returned type incompatibly.
- **Spec v1 semantics:** any change that makes a previously-BUILD spec stop
  building, or renders it differently, under unchanged contracts. (Frozen —
  see workspace-spec-v1.md; spec changes ship as Spec v2 + migration.)
- **Validator/engine behavior** observable by vendors: verdict changes for
  the same inputs, `executeQuery` result changes beyond bug fixes.
- CLI: removing a command/flag, changing exit-code meaning, or breaking the
  documented JSON output shapes.
- `--we-*` theme variable removals/renames.
- Dropping a supported TypeScript minor (CI type-tests matrix) or Node LTS.

**Minor**: new capability, new export, new CLI flag/subcommand, widened
accepted inputs, new optional props. **Patch**: bug fixes that move behavior
toward the documented contract; docs; internal refactors.

## Deprecation policy

1. Deprecate in a **minor**: mark `@deprecated` in types/docs, keep behavior,
   log at most one console warning per process (never per call), state the
   replacement and the earliest removal version in the changeset.
2. Removal happens no earlier than the **next major**, and never less than
   **2 minors / 60 days** after the deprecating release, whichever is later.
3. The CLI warns on deprecated flags but keeps exit-code semantics until the
   major that removes them.

## Support window

- **Current major:** full support — fixes land on `main` and ship in the next
  release.
- **Previous minor:** kept mechanically working — the compat suite (card #51)
  builds the previous minor's example apps against the current packages in
  every CI run; a red compat job blocks release until the change is either
  fixed or re-classified as a major with a migration note.
- **Previous major (once one exists):** security fixes only, 6 months from
  the succeeding major's release.

## Canary channel

Every green `main` build packs the six public packages
(`npm run pack:canary`) and uploads `canary-<sha>` tarball artifacts
(14-day retention). When changesets are pending, versions are snapshot-
stamped `0.0.0-canary-*` so a canary can never be mistaken for a release.
Vendors install a canary by downloading the artifact and pointing npm at the
tarball: `npm i ./workspace-engine-core-0.0.0-canary-x.tgz`. Canaries carry
no support promise.

## Releasing (mechanics)

1. Every user-visible change lands with a changeset (`npm run changeset`) —
   bump chosen per the definitions above, description written for vendors.
2. Merge/push to `main`. CI must be green.
3. The release workflow turns pending changesets into the version commit +
   `vX.Y.Z` tag automatically; canary tarballs are packed on every push.
