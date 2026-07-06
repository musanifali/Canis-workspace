---
tags: [tambo, standards]
created: 2026-07-04
---

# Tambo Coding Standards (condensed)

Source of truth: `tambo/AGENTS.md`. These are upstream's rules — they bind work **inside the clone** (which we avoid), but they're also a sane default for our own code since the demo inherits the ecosystem.

## Philosophy

- Read existing code first; follow its patterns. Simplest design that works wins.
- Functions over classes; short (<20 statements), single-purpose; files <200–300 lines.
- Immutability: no input mutation, `const`, spreads, `toSorted`. Avoid `let` — extract a function returning the value.
- **Fail fast, no silent fallbacks** — throw with explicit messages; handle all enum values, no catch-all defaults.
- Guard clauses + early returns; avoid deep nesting.
- Rule of Three before abstracting.

## TypeScript

- Strict; no `any` (use `unknown` + narrowing); no `as` casts unless unavoidable (validate with Zod at boundaries).
- Named exports only, no default exports, no internal barrel files, no dynamic `import()`.
- Discriminated unions for mutually exclusive states; `satisfies` for literal checking; check `type-fest` before writing clever types.
- Async: `async/await` + try/catch (not `.then/.catch`); `void` only for intentional fire-and-forget.
- No nested ternaries; `switch` with exhaustiveness checking; prefer `map/filter/find`, avoid `reduce`; avoid regex when string methods work.

## Naming

kebab-case files · PascalCase classes · camelCase vars/functions · booleans `is/has/can/should` · components `TamboXxx` · hooks `useTamboXxx` · event props `onX`, handlers `handleX`.

## React

- Functional components (`React.FC`); business logic out of components (`lib/`, `services/`, `utils/`).
- Minimize `useEffect` — derive or memoize; contexts only for genuinely shared dynamic state.
- Tailwind: layout via flex/grid + `gap-*`/`p-*`; **avoid margins** and `space-*`. Real buttons, aria labels, semantic HTML.

## Testing & workflow

- Tests end `.test.ts(x)`, live **beside** the file; only integration tests get `__tests__/`. Mock only at system boundaries.
- Pre-commit: `npm run check-types && npm run lint:fix && npm run format && npm test`.
- Branches `<userid>/<feature>`; PR titles conventional-commit format `type(scope): description`.
