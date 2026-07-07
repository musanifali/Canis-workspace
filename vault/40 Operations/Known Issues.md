---
tags: [ops, gotcha]
created: 2026-07-04
updated: 2026-07-07
---

# Known Issues & Gotchas

## 🔴 Action needed

- **Rotate keys pasted in chat** (all compromised-in-principle): Trello token, OpenRouter, Gemini, **DeepSeek** (2026-07-06).

## 🟠 Active workaround: @tambo-ai/client patch (ADR-6)

- **What**: patch-package on the pinned client SDK — `handleTextMessageEnd`
  tolerates exactly the `message-*` → `msg_*` id handoff (warn + reconcile);
  any other mismatch still throws. `demo/patches/@tambo-ai+client+1.1.3.patch`.
- **Why**: pinned backend emits START with a temp id, END with the persisted id
  (`transformEventMessageIds` early-return). Full context: [[ADR-6 SDK patch for stream id mismatch]].
- **Upstream issue**: https://github.com/tambo-ai/tambo/issues/2974
- **Remove/re-evaluate on every Tambo pin upgrade** — Trello card `mOMsEeE7`.
- Phase 2 renderer must not silently inherit this tolerance.

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
4. **Re-evaluate the ADR-6 client patch** (Trello `mOMsEeE7`): upstream issue
   [#2974](https://github.com/tambo-ai/tambo/issues/2974) fixed → delete
   `demo/patches/` + postinstall hook; not fixed → regenerate the patch against
   the new client version (patch-package fails loudly on version bumps).
5. Re-run `check-tools.mts`, the eval log, and `record-demo.mts` before calling it done
