---
tags: [ops, gotcha]
created: 2026-07-04
updated: 2026-07-04
---

# Known Issues & Gotchas

## 🔴 Action needed

- **Rotate the OpenRouter key** — pasted in chat 2026-07-04. Same for the **Trello token** (pasted earlier). Both compromised-in-principle.
- **OpenRouter budget decision** (`[review][P3]` card) — free tier is **50 requests/day** (resets midnight UTC; exhausted mid-eval on 2026-07-04). $10 credit → 1000/day. This is the only blocker for the ticket-#4 eval baseline ([[Phase 0 Status]]).

## 🟡 Environment traps #gotcha

- **npm version**: the tambo clone blocks npm <11 (`devEngines`); machine has 10.9.7 → run tsx scripts from `demo/` with `npx -y tsx`.
- **`.env` parsing**: API keys contain `=` — `cut -d=` truncates them.
- **Port 3000 is taken** (other project) — demo runs on :3001.
- **Dashboard login impossible locally** — no OAuth/Resend configured; use `seed-tambo-project.mts`.
- **Node import of `@tambo-ai/react`** needs a `Worker` stub ([[Scripts and Eval Harness]]).
- **`additionalContext.userTime`** must be sent or the model guesses dates wrong.
- **Empty array filters** (`[]`) from models must mean "no filter" ([[Case Management Service]]).

## 🟡 Model selection (OpenRouter free tier)

- Current: `nvidia/nemotron-3-ultra-550b-a55b:free` — best tool-calling reliability of the free set
- `nemotron-3-super-120b:free` — intermittently emits tool calls as **text**
- qwen free route — errored outright

## 🟢 Accepted residuals (non-blocking)

- CasesTable radio **deselection is click-only** (no keyboard path)
- Lint: 6 warnings, all confined to template dirs (React-compiler rules quarantined there by design)
- Template's original `npm run lint` crash (eslintrc circular structure) — **fixed** in review via native flat configs; noted for history

## Upgrade procedure (deliberate only)

1. `cd tambo && git fetch && git log --oneline HEAD..origin/main` — review, esp. `apps/api` + `react-sdk`
2. Check out new commit → `tambo-build.sh` → `tambo-start.sh` → `init-database.sh`
3. Bump `@tambo-ai/react` in `demo/` to the matching version (lockstep!)
4. Re-run demo + eval log before calling it done
