# Canis demo runbook

How to drive the Canis vertical-slice demo live in <5 minutes, plus how to
regenerate the recorded walkthrough. Trello #81 (Demo Polish epic).

The narrative: **a plain-language sentence becomes a validated, live,
saveable, native workspace — and unsafe or ungrounded requests get a grounded
refusal, not a hallucination.**

---

## 1. Prerequisites (one-time per machine)

1. **Docker running.**
2. **Backend + model up** — from the repo root:
   ```bash
   cd tambo && ./scripts/cloud/tambo-start.sh   # serves the Tambo API on :8261
   ```
   Model: `deepseek-v4-flash`. Confirm: `curl -s -o /dev/null -w '%{http_code}' http://localhost:8261/` → `200`.
3. **Demo app** — from `demo/`:
   ```bash
   npm ci          # first time only
   npm run build
   npx next start -p 3001
   ```
   `demo/.env.local` must have `NEXT_PUBLIC_TAMBO_URL=http://localhost:8261` and
   `NEXT_PUBLIC_TAMBO_API_KEY=…` (already committed for the demo machine).
4. Open **http://localhost:3001**.

> **The recurring trap:** a stale dev bundle renders convincing *skeletons*
> with no data. Always confirm real values on screen (case IDs like
> `CASE-1234`, analyst names, dollar amounts) before you start narrating. If a
> block is empty or skeletal, hard-reload; if still empty, rebuild.

---

## 2. Reset between runs

The save→reload beat writes to `localStorage`. To present a clean cold-start:

- **Full reset (cold machine feel):** in DevTools console on any demo page:
  ```js
  localStorage.clear(); location.reload();
  ```
  This empties `/saved` (so the empty-state + "Load demo examples" beat shows)
  and clears any in-progress thread.
- **Between takes without losing seeds:** just start a new thread on `/create`
  (the `+` in the thread rail) — the workspace area resets.

---

## 3. The live script (≈4–5 min)

Beats in order. Talk-track is ~30s each; the exact prompts are the ones the
pipeline is tuned for.

### Beat 1 — Landing (`/`) · ~20s
> "This is Canis. One idea: you describe the workspace you need in plain
> language, and you get back something *safe, saved, and native* — not a chat
> reply. Three ways in: Create, curated Workspaces, and a zero-config Sandbox."

Click **Open Create**.

### Beat 2 — Create: sentence → live screen (`/create`) · ~60s
Type the **flagship prompt** exactly:
```
Show high-risk cases due this month, grouped by analyst
```
Press Enter.
> "It's not templating a chart. The model authors a workspace *spec* — you can
> watch the JSON stream — and that spec is validated against our data
> contracts *before* anything renders. Valid → a live board, grouped by
> analyst, backed by the real 240-case dataset."

Wait for the grouped board of real `CASE-####` cards to render.

### Beat 3 — Refine · ~30s
Type a follow-up in the same thread:
```
Only show critical risk
```
> "Refinement is just another sentence — re-validated, re-rendered."

### Beat 4 — Save · ~20s
Click **Save workspace** (top-left bar). Wait for "Saved … Open".
> "That workspace is now a first-class saved object — not an export."

### Beat 5 — Reload with live data (`/saved`) · ~30s
Click **Saved** in the nav (or the "Open" link).
> "Reopened from storage, it re-renders through the exact same deterministic
> read path — live data, byte-identical spec." (If cold, click **Load demo
> examples** first to populate the grid.)

### Beat 6 — The safety beat: grounded refusal (`/create`) · ~45s
New thread (`+`), then type the **refusal prompt**:
```
Group high-risk cases by customer sentiment score
```
> "There's no 'sentiment score' in our contracts. Instead of inventing a
> column, the validator refuses and says exactly why. This is the compliance
> story: it can only ever render what the data actually supports — 100% of
> injection/out-of-scope attempts are blocked."

Wait for the reject notice naming the unknown field.

### Beat 7 — Curated workspaces (`/workspaces`) · ~20s
> "The same engine renders hand-authored specs deterministically — no LLM in
> the loop. Compliance Overview, Active Work Queue, Portfolio by Category."

### Beat 8 — Zero-config sandbox (`/sandbox`) · ~15s
> "And a live, data-backed workspace with zero config — no contracts, no
> network — for the 10-minute on-ramp."

### Beat 9 — "It's inspectable" (optional, `/create`) · ~20s
Toggle the **devtools** panel (bottom-right) on a generated workspace.
> "Every spec, every validator verdict, every query is inspectable."

---

## 4. Prompt cheat-sheet

| Purpose | Exact prompt |
|---|---|
| Flagship (renders) | `Show high-risk cases due this month, grouped by analyst` |
| Refine | `Only show critical risk` |
| Grounded refusal | `Group high-risk cases by customer sentiment score` |
| Alt render (KPIs) | `Total exposure and average risk score across all cases` |

---

## 5. Regenerate the recorded walkthrough

With the stack up (§1) and the demo on `:3001`:
```bash
cd demo && npx -y tsx scripts/record-walkthrough.mts
```
Output: `demo/eval/videos/canis-walkthrough-<date>.webm` + per-beat PNGs. The
script drives the beats above with Playwright, **asserting visible data**
(`CASE-####`) at each render so a stale/skeletal run fails loudly instead of
recording an empty demo. Console/page/HTTP errors are reported on stdout.
