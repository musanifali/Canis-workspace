---
tags: [tambo, package]
created: 2026-07-04
---

# React SDK (`@tambo-ai/react`)

`tambo/react-sdk/` — the package `demo/` pins at **exact 1.3.0**. Core hooks, providers, and utilities for AI-powered React apps. Dual CJS (`dist/`) + ESM (`esm/`) builds.

## What it provides

- **`TamboProvider`** — root provider taking API key, registered components, tools ([[Component Registration]])
- **Hooks** (naming: `useTamboXxx`):
  - `useTamboRegistry` — component/tool registration
  - `useTamboThread` — thread state + messages
  - `useTamboThreadInput` — chat input handling
  - `useTamboStreaming` — progressive streaming of AI content
  - `useTamboSuggestions` — AI suggestions
  - `useTamboComponentState` — AI-readable/writable component state (used by our [[Workspace Blocks]])
- **`withInteractable`** — wrapper letting the AI update an already-rendered component's props

Under the hood it delegates to [[Client Package]] as its engine.

## Gotchas we've hit #gotcha

- Importing it in **Node** (eval harness) requires stubbing `Worker` — see [[Scripts and Eval Harness]]
- It talks to a specific API surface — keep SDK version in lockstep with the self-hosted backend commit ([[Demo App Overview]])
