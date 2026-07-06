---
tags: [demo, tambo-api]
created: 2026-07-04
---

# Component Registration

`demo/src/lib/tambo.ts` is the **single registration point** — the AI can only render components and call tools listed here.

## The pattern

```ts
// components array — each entry:
{
  name: "CasesTable",
  description: "…when to use it…",   // the model reads this
  component: CasesTable,
  propsSchema: casesTableSchema,      // Zod — validates AI-supplied props
}

// tools array — each entry:
{
  name: "searchCases",
  description: "…",
  tool: searchCases,
  toolSchema: z.function().args(…).returns(…),
}
```

Props types come from `z.infer<typeof schema>` — schema is the source of truth, mirroring the future `defineEntity` contracts ([[Architecture Decisions]] ADR-3).

`TamboProvider` in `src/app/layout.tsx` receives the arrays plus the API key and makes them available app-wide.

## How rendering actually happens #gotcha

The model doesn't emit JSX — it makes a **server-handled tool call** `show_component_<Name>` with props. The rendered result surfaces on the thread message's `component` field (read back via `GET /threads/:id/messages`). This is how the eval harness detects which block was chosen — see [[Scripts and Eval Harness]].

## Adding a new block

1. Component in `src/components/workspace/` with a Zod propsSchema (reuse `caseSchema` where possible)
2. State-bearing? Use `useTamboComponentState`
3. Register in `tambo.ts` with a description the model can act on
4. Add coverage to `scripts/check-tools.mts` if the block depends on tool behavior

Registered blocks: [[Workspace Blocks]]. Registered tools: [[Case Management Service]].
