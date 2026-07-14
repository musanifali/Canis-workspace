---
tags: [handoff, demo, phase-demo-polish]
created: 2026-07-14
---

# Demo Polish implementer kickoff (Canis)

Canonical copy of the brief handed to the Demo Polish implementer session.

## Role & sources
Implementer per [[Review Workflow]]. Read: MEMORY recall, [[Operating Model]],
[[2026-07-14 — Demo Polish epic]], [[Tambo design system extract]], and the
🎨 Demo Polish Trello list. Cards → In Progress when done; reviewer closes.

## State
Phases 0–3 complete + reviewer-verified (NL → validated spec → live screen →
save/reload → grounded refusal; 92% valid, 100% injections blocked). This epic
= make the demo presentation-ready. **Presentation/UX only.**

## Hard boundary (auto-reject if violated)
No changes to product packages (@workspace-engine/core|react|ui|devtools) or
the pipeline. Demo-local only: `demo/src/app/**`, `demo/src/components/**`,
demo token/CSS layer. ui-block QA tunes DEMO `--we-*` overrides, never package
source.

## Order (FOUNDATION first)
1. DESIGN FOUNDATION — `demo/DESIGN.md` + demo token layer + fonts. Prereq.
2. Landing (replace tambo scaffold) + title/favicon/meta.
3. Unified shell + top nav.
4. /create polish (strip template chrome, framing, empty/composing states).
5. Seed content + /saved.
6. ui-block visual QA (demo tokens only).
7. Recorded walkthrough + RUNBOOK.md (LAST).

## Design direction
"Trust-forward minimalism, Tambo-adjacent." Keep Tambo bones, read
institutional (banks/compliance). Tambo system extracted in
[[Tambo design system extract]]; repo at `./tambo-landing` (mine hero/nav/CTA +
GSAP motion; NOT the WebGL/3D/Rive). Fonts Sentient Light 300 / Geist / Geist
Mono + ServerMono (woff2 in tambo-landing/public/fonts); #F2F8F6 / #0F1A17;
12-col 1440 grid; ease cubic-bezier(0.4,0,0,1).

**Name = Canis** (behind a swappable constant). **Accent (open decision):** NOT
Tambo neon-green — green = status here (valid/allowed/low-risk). Recommend a
distinct institutional accent (deep indigo/blue) + green/amber/red reserved as
status/risk tokens. Implement recommended accent as a token default, flag on
the card, don't block.

## Conventions
Per-ticket conventional commits, pushed. `npm run build && npm test` in demo/
before commit. Judgment calls → card comments. Session log in `50 Logs/`.
Before/after screenshots at 1440 on visual tickets.

## Gotchas (cost hours)
- **Product repo = `/Users/thamacstore/tambo`. `tambo/` is the vendored clone
  with its OWN git + husky + npm≥11 devEngines.** Never run git after cd-ing
  into `tambo/` — wrong repo (this bit the reviewer this session).
- Stack up: docker + `cd tambo && ./scripts/cloud/tambo-start.sh` (:8261);
  demo on :3001; model deepseek-v4-flash.
- Restart Next dev server after package/node_modules changes (stale bundle =
  convincing skeletons — 4th-time trap).
- Headless /create: page.evaluate focus `.tiptap[contenteditable]` +
  keyboard.type + Enter. Assert visible DATA (/CASE-\d{4}/), not element counts.
- Flagship prompt: "Show high-risk cases due this month, grouped by analyst."
  Refusal beat: "group by customer sentiment score."

## Definition of done
Cold machine + RUNBOOK delivers the full narrative <5 min; nothing says
"template/scaffold/tambo-ai"; every surface reads as one Canis product.
