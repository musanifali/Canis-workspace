---
tags: [tambo, package]
created: 2026-07-04
---

# Client Package (`@tambo-ai/client`)

`tambo/packages/client/` — framework-agnostic core engine: streaming, tool execution, thread management **without React**.

## Key surface

- **`TamboClient`** class — `getState()` / `subscribe()` for integrating any framework (Node, Vue, Svelte, …)
- **`TamboStream`** — async iterable over streaming AI responses

[[React SDK]] uses this as its engine; it's also usable standalone.

## Why it matters to us

The eval harness ([[Scripts and Eval Harness]]) is effectively a standalone consumer of the same machinery — headless Node driving `advancestream`, executing client tools locally, appending `role:"tool"` messages. If we ever need a non-React surface (server-side spec generation, tests for the validator pipeline), this package is the intended entry point rather than the React SDK.

Dual CJS/ESM builds, like the SDK.
