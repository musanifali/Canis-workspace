# @workspace-engine/react

The read-time SDK for the Workspace Engine: a validated `WorkspaceSpec` becomes a
live, data-backed screen with zero LLM involvement. Deterministic renderer,
headless hooks, `WorkspaceProvider` + block registration, graceful degradation,
and an in-memory query engine so a vendor integrates by returning rows.

`react` is the only peer dependency — no `react-dom` requirement, SSR-compatible.

## Bundle-size budget

We're asking to be added to someone's production app, so every kilobyte is a tax.
The published bundle is measured on every CI run with
[`size-limit`](https://github.com/ai/size-limit) (minified + brotli, with `react`
/ `react-dom` excluded as peers). The build fails if a change blows the budget.

| Entry | Budget | Notes |
| --- | --- | --- |
| Full import (`*`) | **40 KB** | Everything, incl. bundled `@tanstack/react-query` + `zod` (via core). Currently ~32 KB. |
| `WorkspaceProvider` + `WorkspaceRenderer` | **40 KB** | The common integration path. |
| `resolveQueryDates` alone | **2 KB** | Proves tree-shaking: importing one pure helper drops react-query **and** zod (~700 B). |

Run locally with `npm run size` (after `npm run build`). The third entry is the
tree-shaking guard — if it ever approaches the full-import size, a side-effect or
a barrel import has defeated tree-shaking.

## SSR

`WorkspaceRenderer` renders to HTML on the server and hydrates on the client with
no mismatch (a Next.js Server Component page is the target). A dedicated
SSR + hydration smoke test runs in CI so the "SSR-compatible" claim can't regress
silently.
