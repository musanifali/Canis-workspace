---
tags: [demo, tooling]
created: 2026-07-04
---

# Scripts and Eval Harness

`demo/scripts/` — all run with `npx -y tsx` **from `demo/`** (the tambo clone blocks npm <11, see [[Known Issues]]).

## The scripts

| Script | Does |
|---|---|
| `seed-tambo-project.mts` | Provisions user/project/API key directly via Tambo db operations (dashboard login is impossible locally), writes `demo/.env.local`. Needs `DATABASE_URL` sourced from `../tambo/docker.env`. |
| `configure-llm.mts <key> [model] [baseUrl]` | Sets the project's LLM provider (OpenRouter via `openai-compatible`). Keys stored encrypted per-project via `PROVIDER_KEY_SECRET`. |
| `set-instructions.mts` | Sets project `customInstructions` — component-first prompting. |
| `check-tools.mts` | **15 regression checks** guarding tool behaviors ([[Case Management Service]] invariants). Run before every eval. |
| `eval-prompts.mts` | The eval harness (ticket #4). Results → `demo/eval/phase0-quality-log.{json,md}`. |

## How the eval harness works

Headless `advancestream` loop against the Tambo API:

1. Sends `availableComponents` + `clientTools` with each turn
2. **Executes tool calls locally**, appends `role:"tool"` messages, continues the stream
3. Detects the model's component choice by reading the thread back (`GET /threads/:id/messages`) — component decisions surface as server-handled `show_component_<Name>` tool calls with the result on the message's `component` field

## Hard-won Tambo mechanics #gotcha

- Send `additionalContext.userTime` or the model guesses dates wrong
- Models send `[]` for unused array filters — treat as no-filter
- Importing `@tambo-ai/react` in Node needs a `Worker` stub
- API auth header is `x-api-key`; keys contain `=` so **don't parse `.env` with `cut -d=`**

## Current blocker

Eval baseline is blocked only on the OpenRouter budget decision — see [[Phase 0 Status]] and [[Known Issues]].
