# @ticora/cli

## 0.3.1

### Patch Changes

- 4f5edc1: Publish the packages publicly.

  0.3.0 was published as **restricted**: `changeset publish` passes the `access`
  value from `.changeset/config.json`, which defaults to `restricted` and
  overrides each package's `publishConfig.access`. The packages existed on the
  registry but `npm install @ticora/…` returned 404 for everyone. The config is
  now `public`, and this release makes the packages publicly installable.

- Updated dependencies [4f5edc1]
  - @ticora/core@0.3.1
  - @ticora/client@0.3.1

## 0.3.0

### Minor Changes

- 4bd3f39: First npm release under the `@ticora` scope.

  - Packages renamed from `@workspace-engine/*` to `@ticora/*`, and the vendor CLI
    binary from `canis` to `ticora`. Done before the first publish so no adopter
    ever has to migrate.
  - `@ticora/core` adds `defineBlockType` and `extendRegistry`: author a custom
    block type without hand-writing registry internals. A config schema that
    isn't `.strict()` is refused at definition time, so a custom type can never
    be a hole in the validator.
  - `@ticora/react` adds a `./testing` entry point: `assertBlockContract` drives a
    block component through every state the renderer can hand it (loading,
    success, empty, error, stale-while-refetching) and derives the expected data
    shape from the registry, so a component can't pass against data it will never
    receive. Render-agnostic — it pulls in no react-dom and no testing library.

### Patch Changes

- Updated dependencies [4bd3f39]
  - @ticora/core@0.3.0
  - @ticora/client@0.3.0

## 0.2.0

### Patch Changes

- Updated dependencies [5b9280b]
  - @ticora/client@0.2.0
  - @ticora/core@0.2.0
