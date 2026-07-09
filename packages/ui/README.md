# @workspace-engine/ui

The **default block set** for the Workspace Engine: a complete, themeable set of
blocks so day-1 integration needs **zero component work** and looks decent.
Table, KPIs, queue, board, filter bar, chart — one per registry block type.

Native controls throughout (real `<table>`, `<form>`, `<button>`, `<label>`) — no
clickable divs, no ARIA gymnastics.

## Quickstart — a live screen in under 10 minutes

Zero contracts, zero blocks, zero network. Drop one component into your app:

```bash
npm install @workspace-engine/react @workspace-engine/ui
```

```tsx
import { WorkspaceSandbox } from "@workspace-engine/ui";

export default function Page() {
  return <WorkspaceSandbox />;
}
```

You now have a live, data-backed workspace inside your own app shell, rendered
against a bundled sample contract with seeded data. The console prints your next
step:

> **Next step:** define your first entity with `defineEntity()` and pass it via
> `contracts`, then register your blocks (or keep `defaultBlocks`).

When you're ready, replace the sandbox with the real thing — same blocks, your
data:

```tsx
<WorkspaceProvider apiKey={apiKey} userToken={userToken} contracts={[myEntity]} blocks={defaultBlocks}>
  <WorkspaceRenderer spec={spec} />
</WorkspaceProvider>
```

## Day 1 — works before you customize

```tsx
import { WorkspaceProvider, WorkspaceRenderer } from "@workspace-engine/react";
import { defaultBlocks } from "@workspace-engine/ui";

<WorkspaceProvider apiKey={apiKey} userToken={userToken} contracts={contracts} blocks={defaultBlocks}>
  <WorkspaceRenderer spec={spec} />
</WorkspaceProvider>
```

That's it — every block type renders against your contracts with real data.

## Theming

Every block styles itself through `--we-*` CSS custom properties with sensible
fallbacks. Theme the whole set by setting variables on any ancestor — no CSS
import, SSR-safe:

```tsx
<div style={{ "--we-accent": "#7c3aed", "--we-radius": "12px", "--we-font-size": "14px" } as React.CSSProperties}>
  <WorkspaceRenderer spec={spec} />
</div>
```

Tokens: `--we-bg`, `--we-surface`, `--we-fg`, `--we-muted`, `--we-border`,
`--we-accent`, `--we-positive`, `--we-negative`, `--we-radius`, `--we-gap`,
`--we-pad`, `--we-font-size`, `--we-font-family` (see `tokens` / `TOKEN_NAMES`).

## The swap path — replace one block at a time

The adoption story is: **our blocks day 1 → your design-system components,
one block at a time.** A block is just a component registered for a type, so
overriding one is a one-line `map`:

```tsx
import { defineBlock } from "@workspace-engine/react";
import { defaultBlocks } from "@workspace-engine/ui";
import { MyCasesTable } from "@/components/MyCasesTable"; // your own component

const blocks = defaultBlocks.map((b) =>
  b.type === "CasesTable"
    ? defineBlock({ type: "CasesTable", accepts: { shape: "rows" }, component: MyCasesTable })
    : b,
);
```

Your component receives `BlockComponentProps` — `block` (id, type, config) plus
the resolved data state (`status`, `data`, `error`, `isFetching`, `refetch`).
The renderer still handles loading skeletons and broken-block states around it,
so you only render the success case. Swap as many as you like; the rest stay on
the defaults. Nothing else in your integration changes.

### Proof: the demo did exactly this

The demo app (`demo/`) originally hand-rolled four adapter components. Adopting
this package deleted `demo/src/workspace-engine/blocks.tsx` outright and changed
the kit to a single line — `export const blocks = defaultBlocks;` — with the
live specs, snapshot tests, and Playwright e2e all still green. If the swap were
painful, the on-ramp would be broken; it wasn't.

## FilterBar

`FilterBar` is interactive: it renders a labeled text input per `config.fields`
and pushes a `contains` filter onto every `config.targets` block through the
runtime filter bus (`WorkspaceFilterProvider`, mounted by `WorkspaceRenderer`).
Target blocks refetch with the extra filters merged in — the saved spec is never
mutated.
