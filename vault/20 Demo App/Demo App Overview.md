---
tags: [demo, moc]
created: 2026-07-04
---

# Demo App Overview

`demo/` — the Phase 0 vertical-slice app. Next.js 15 (App Router) + React 19 + TypeScript strict + Tailwind v4 + Zod, scaffolded with `create-tambo-app` 0.3.5. Runs on **:3001** (see [[Ports and Services]]), talks to the self-hosted Tambo API on :8261.

## Version pins (deliberate, never automatic)

| What | Pin |
|---|---|
| `@tambo-ai/react` | **1.3.0 exact** (no `^`) |
| Backend docker images | built from `../tambo` @ commit `6861a3f2` (2026-06-16) |

SDK and backend move in **lockstep** — upgrade procedure in `demo/README.md` (fetch clone → review → rebuild images → migrate → bump SDK → re-run eval).

## Source layout

```
demo/src/
├── app/                    # App Router pages
│   ├── layout.tsx          # root layout — wraps app in TamboProvider
│   ├── chat/               # chat intake route
│   └── interactables/      # template's interactables demo (leftover)
├── components/
│   ├── workspace/          # OUR 6 blocks → [[Workspace Blocks]]
│   └── tambo/              # template chat UI (message/thread components)
├── lib/
│   ├── tambo.ts            # CENTRAL CONFIG → [[Component Registration]]
│   └── thread-hooks.ts, utils.ts, use-anonymous-user-key.ts
└── services/
    └── case-management.ts  # → [[Case Management Service]]
```

Supporting dirs: `scripts/` ([[Scripts and Eval Harness]]) and `eval/` (phase0-quality-log).

## Key Tambo hooks used

`useTamboThread`, `useTamboThreadInput`, `useTamboStreaming`, `useTamboSuggestions`, `useTamboComponentState` (state-bearing blocks), `withInteractable`.

## Related

[[Getting Started]] · [[Self-Hosted Stack]] · [[Phase 0 Status]] · [[Known Issues]]
