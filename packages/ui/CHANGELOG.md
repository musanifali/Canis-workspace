# @ticora/ui

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
  - @ticora/react@0.3.0

## 0.2.0

### Patch Changes

- Updated dependencies [5b9280b]
  - @ticora/react@0.2.0
  - @ticora/core@0.2.0
