---
tags: [reference, design]
created: 2026-07-14
---

# Tambo design system — extracted (reference for Canis Demo Polish)

Source: the Tambo website repo the user added at
`/Users/thamacstore/tambo/tambo-landing` (`name: tambo-website`; Next.js +
GSAP + react-three-fiber + Rive + Lenis + base-ui/radix). Extracted 2026-07-14
to ground the Canis DESIGN FOUNDATION ticket. **Mine kinship from this, don't
copy the WebGL/3D machinery** — Canis is a compliance product, calmer.

## Fonts (`styles/fonts.ts`; woff2 in `public/fonts/`)
- **Sentient Light (300)** — display/headings (single light weight; big + airy).
- **Geist (400/500)** — body.
- **Geist Mono (400/500/700)** — code.
- **ServerMono (400)** — a distinctive mono (data/labels accent).

## Color (`styles/css/root.css`)
- Surfaces: off-white `#F2F8F6`, light-gray `#E5F0ED`, grey `#D8E9E4`,
  dark-grey `#CBE2DB`, white `#FFFFFF`.
- Ink: black `#0F1A17` (forest-black).
- **Brand green ramp:** ghost-mint `#D6FFEC` · mint `#B6FFDD` · teal `#7FFFC3`
  · dark-teal `#80C1A2` · forest `#008346` · neon green `#00FF88`.
- Accents: red `#E30613`, blue `#0070F3`, purple `#7928CA`, pink family
  `#FFC4EB`/`#FFD6F1`/`#E1C9D9`.

## Layout / grid (`root.css`)
- Desktop (`dt` variant): **12 columns**, `--max-width: 1440`, gap 24px, safe
  margin 40px, header 98px. Mobile: 4 columns, gap 12, safe 24, header 58.
- Fluid sizing via `min(calc(... * 1vw), calc(... * 1px))` with a
  `--calc-factor` — everything scales with viewport up to 1440 then pins.

## Motion (`root.css`)
- Full cubic-bezier easing set (in/out/in-out × quad/cubic/quart/quint/expo/
  circ). **Signature curve: `--ease-gleasing: cubic-bezier(0.4, 0, 0, 1)`.**
- Lenis smooth scroll + GSAP; a gradient keyframe (`--animate-gradient`,
  8s linear) for the animated-gradient text/CTA effect.

## Recommendation for Canis (name now confirmed)
Keep Tambo's BONES — Sentient/Geist, `#F2F8F6`/`#0F1A17`, 12-col 1440 grid,
the easing curves, generous whitespace — but:
- **Own accent, not Tambo's neon mint.** Green carries STATUS meaning in this
  product (BUILD/valid/allowed at the gate; low-risk tier), so using green as
  the BRAND accent clashes with green-as-status. Recommend a distinct,
  institutional brand accent (deep indigo/blue — Stripe/Linear register) and
  reserve green/amber/red for status + risk tiers as named tokens.
- **Canis = the hound / watchdog** — guardian semantics fit a compliance tool
  that "guards" what renders. A restrained, trustworthy identity over playful.
- App surfaces denser/calmer than the landing (Linear/Vercel); landing may use
  a touch of the gradient/easing flourish for kinship.

Relates to the DESIGN FOUNDATION ticket (Demo Polish list) and
[[2026-07-14 — Demo Polish epic]].
