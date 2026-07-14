# Canis demo design system

Prerequisite foundation for the Demo Polish epic (Trello 🎨 Demo Polish list,
card #82). Every other Demo Polish ticket builds on the tokens and vocabulary
documented here instead of inventing its own. Implemented in
`src/app/globals.css` (`@theme inline` + `:root`) and `src/lib/fonts.ts`.

## Principles

1. **Trust-forward minimalism.** Built on Tambo — keep the kinship (type
   system, spacing rhythm, rounded solid CTAs) — but this product's surfaces
   get shown to banks and compliance teams. Dial the developer-playfulness
   down (no mascot, one restrained accent) and data-precision up.
2. **Green means status, not brand.** Tambo's marketing palette is green.
   Here, green/amber/orange/red are the risk-tier vocabulary the product
   exists to show. The brand accent is a distinct institutional indigo so a
   "safe" screen and a "branded" screen never look the same by accident.
3. **App surfaces are sober; landing can be expressive.** `/create`,
   `/workspaces`, `/saved`, `/sandbox` read like Linear/Vercel — dense,
   calm, hairline borders, minimal shadow. The landing page is the one place
   allowed more motion and typographic confidence.
4. **One documented vocabulary, reused everywhere.** Every primitive below is
   the thing later tickets compose with, not a starting point for a new one.
5. **Reduced motion is not an afterthought.** Every animated primitive has a
   `prefers-reduced-motion` fallback baked into the base layer, not bolted on
   per-component.

## Color

Light theme only (no dark mode is wired up in this demo — see the removed
`.dark` block in git history if that changes). All tokens are CSS custom
properties on `:root`, surfaced to Tailwind via `@theme inline` so they're
usable as `bg-background`, `text-foreground`, `border-border`, etc.

| Token | Value | Use |
|---|---|---|
| `--background` | `#FAFCFB` | Page background |
| `--foreground` | `#0F1A17` | Default text (Tambo's own near-black) |
| `--card` | `#F2F5F4` | Raised surface |
| `--popover` | `#FFFFFF` | Popovers, block surfaces |
| `--muted` / `--muted-foreground` | `#EEF2F1` / `#5C6864` | Secondary surfaces, secondary text |
| `--border` / `--input` | `#E1E7E5` | Hairline borders |
| `--primary` / `--accent` | `#33389E` ("Canis Indigo") | Brand accent, CTAs, focus ring |
| `--secondary` | `#E8E9F5` on `#33389E` | Low-emphasis brand surface |
| `--destructive` | `#DC2626` | Errors, destructive actions |
| `--success` | `#15803D` | Confirmations (distinct from risk-low; e.g. "saved") |

**Risk tiers** — the domain's own status vocabulary, each with a solid and a
tint-background variant for chips: `--risk-low` (`#15803D`), `--risk-medium`
(`#B45309`), `--risk-high` (`#C2410C`), `--risk-critical` (`#B91C1C`), each
paired with `--risk-*-bg` for badge backgrounds. The solid values are
deliberately a shade darker than the obvious Tailwind 500-tier equivalents
(`#16A34A`/`#D97706`/`#EA580C`/`#DC2626`) — those fail WCAG AA (4.5:1) against
both their own light `-bg` tint and white block backgrounds; verified by
computing contrast ratios directly (see card #82).

**Open decision (flagged, not blocking — see card #82 comment):** the accent
is a recommendation, not a final brand ruling. Tambo-green kinship was
considered and rejected because green is a risk-tier color here; a distinct
institutional accent reads as its own product. Swap `--primary`/`--accent`/
`--ring` in one place if the user picks differently.

## Type

Three families, one job each — never mixed within a single text role:

- **Sentient** (weight 300 only, `--font-sentient` / `font-sentient`
  utility) — display and headings. Expressive, used sparingly.
- **Geist** (`--font-geist`, default `font-sans`) — body copy, UI labels,
  buttons.
- **Geist Mono** (`--font-geist-mono`, default `font-mono`) — data: case
  IDs, amounts, timestamps, code. Also the default `--we-font-family` for
  `@workspace-engine/ui` blocks, so table/KPI data reads as data everywhere.

| Role | Family | Size / line-height | Notes |
|---|---|---|---|
| Display (landing hero) | Sentient 300 | 56–64px / 1.05 | Landing only |
| H1 | Sentient 300 | 36–40px / 1.1 | Page-level title |
| H2 | Sentient 300 | 26–28px / 1.15 | Section title |
| H3 / app section head | Geist 500 | 18–20px / 1.3 | Denser than Sentient — app surfaces |
| Body | Geist 400 | 14–16px / 1.5 | Default paragraph |
| Small / label | Geist 400/500 | 12–13px / 1.4 | Uppercase + tracked for labels |
| Data / mono | Geist Mono 400/500 | 12–13px / 1.4 | Tables, IDs, amounts |

Font files live in `public/fonts/{Sentient,Geist,GeistMono}` (copied from the
`tambo-landing` reference repo) and load via `next/font/local` in
`src/lib/fonts.ts` — no external font requests, matches Tambo's own setup.

## Spacing & layout

4px base scale (Tailwind's default `spacing-*` already matches — no
override needed): 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64px.

- **Container:** `max-width: 1440px`, centered, 24px gutter desktop / 16px
  mobile.
- **Grid:** 12-column at the 1440 container width.
- **Section rhythm:** 64–96px vertical gap between major landing sections;
  24–32px between app-surface sections.

## Radius, elevation, borders

- `--radius: 0.5rem` (8px), matching Tambo's own `globals.css`. Scale:
  `--radius-sm` (4px), `--radius-md` (6px), `--radius-lg` (8px, = base),
  `--radius-xl` (12px) — exposed to Tailwind so `rounded-sm/md/lg/xl` map to
  the scale.
- **Borders over shadows.** Default to a 1px `border-border` hairline for
  separation (Linear-style calm density). Reserve shadow for true elevation
  (popovers, modals): `shadow-sm` for cards on hover, `shadow-lg` for
  floating surfaces. Avoid decorative shadow on static cards.

## Motion

- `--ease-standard: cubic-bezier(0.4, 0, 0, 1)` — the default for hover,
  route, and state transitions (mined from `tambo-landing`'s `gleasing`).
- `--ease-entrance: cubic-bezier(0.165, 0.84, 0.44, 1)` (out-quart) — for
  content entering (stream-in, mount).
- Durations: `--duration-fast` 150ms (hover/focus), `--duration-base` 250ms
  (standard transitions), `--duration-slow` 400ms (stream-in, route).
- **What animates:** stream-in (fade + 4px translate-y, `--ease-entrance`),
  hover (opacity/background, `--ease-standard` `--duration-fast`), route
  transitions (simple fade, `--duration-base`). Nothing else — no
  decorative motion on static content.
- **Reduced motion:** handled once, globally, in `globals.css`'s base layer
  (`prefers-reduced-motion: reduce` collapses all durations to ~0). Don't
  re-implement per component.

## Primitive inventory

The vocabulary later tickets compose with. Not all of these are built yet —
this is the spec; build them where first needed and keep them here.

- **Button** — variants `primary` (solid indigo), `secondary` (tint indigo),
  `ghost` (transparent, border on hover), `destructive` (solid red). Sizes
  `sm` (32px), `md` (36px), `lg` (44px). Radius `--radius-lg`.
- **Input** — hairline `border-border`, `--radius-md`, focus ring
  `ring-2 ring-ring`, Geist body text.
- **Card** — `bg-card` or `bg-popover`, `border-border` hairline,
  `--radius-lg`, `shadow-sm` only if it needs to read as "floating."
- **Nav item** — Geist 500 label, active state = `text-primary` +
  1px bottom border in `--primary` (not a filled pill — stays restrained).
- **Badge / chip** — risk-tier color from the table above:
  `bg-risk-{tier}-bg text-risk-{tier}`, `--radius-xl` (pill), Geist Mono
  label, uppercase, tracked.
- **Table density spec** — row height 40px (compact) default, 48px
  (comfortable) optional; cell padding `--we-pad` (8px) horizontal, 6px
  vertical; header row: Geist Mono, uppercase, `text-muted-foreground`,
  `--we-border` bottom rule.

## `@workspace-engine/ui` baseline

`packages/ui/src/theme.ts` themes every default block through `--we-*`
custom properties on any ancestor (see that file's docstring). This ticket
sets a baseline at `:root` in `globals.css` — accent, radius, density, and
Geist Mono as the block data font — so every block already looks like Canis
without per-block work. **Ticket #80 (visual QA) does the screenshot-verified
fine-tuning pass** against real seeded data; it must only ever touch these
demo-level `--we-*` values, never `packages/ui` source.

## Scope note

This ticket's deliverable is this document + the token layer + font wiring
(`globals.css`, `src/lib/fonts.ts`, `src/app/layout.tsx`). It does not touch
`@workspace-engine/{core,react,ui,devtools}` package source, and it does not
build out every primitive component — later tickets do that, against this
spec.
