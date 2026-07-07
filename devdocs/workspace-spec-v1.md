# Workspace Spec v1

**Status: FROZEN v1** (2026-07-07, review pass on Trello card `qiLtVFPt`;
amendments A1–A4 applied). Changes from here require a `specVersion` bump and
a migration per §9.
**Owners:** Workspace Engine core
**Last updated:** 2026-07-07

This document is the contract between the four parties that never talk to each
other directly: the **LLM** (emits specs), the **validator** (gates them), the
**renderer** (materializes them without any LLM at read time), and the
**store** (persists them for years). Everything in Phase 1 implements this
document; when code and this document disagree during Phase 1, the document
wins until the freeze, after which changes require a version bump.

## 1. Design principles

1. **Everything is data.** A workspace is a JSON document. No code, no JSX, no
   expressions — every capability the spec grants is enumerable and auditable.
2. **The spec is written once, read forever.** Saved workspaces are long-lived
   customer data. Anything resolved at *generation* time that should reflect
   *read* time (dates, "my cases") is stored symbolically and resolved at
   query execution.
3. **Validation is total.** No spec reaches the renderer without passing the
   validator. The validator's verdict is `BUILD | CLARIFY | REJECT` — there is
   no "render what we can" mode. (Phase 0 evidence: both baseline misses were
   silent text/empty fallbacks; the validator exists to make these loud.)
4. **The contract bounds the spec.** A spec may only reference entities,
   fields, and operations declared by a `defineEntity` contract. The invariant
   (property-tested in Phase 1): *no spec that passes validation can reference
   an uncontracted field, component, or operation.*
5. **Renderers tolerate streaming.** Specs arrive progressively during
   generation; every renderer must survive any prefix of a valid spec (Phase 0
   lesson: blocks crashed on partial props). The *saved* spec is always
   complete and validated.

## 2. Top-level shape

```jsonc
{
  "specVersion": 1,              // integer; see §9 Versioning
  "title": "High-risk cases this month",
  "description": "…",            // optional, user-facing
  "timezone": "viewer",          // "viewer" | IANA zone; see §6 Time
  "refresh": { "mode": "manual" }, // see §8
  "layout": { "columns": 12 },   // see §3
  "blocks": [ /* Block[] */ ]    // see §4; 1..24 blocks
}
```

Unknown top-level keys → `REJECT` (`SpecShapeError`). `specVersion` above the
validator's supported range → `REJECT` (`SpecVersionError`); below → lazy
migration (§9).

**Null handling (A3):** optional values are **omitted, never null**. An
explicit `null` anywhere a value is optional → `REJECT` (`SpecShapeError`).
The single exception is `binding: null`, which is not an omitted optional but
the explicit discriminator for static (data-less) blocks (§4).

## 3. Layout model — 12-column grid

- The canvas is a **12-column grid** with unit-height rows; row height and
  gutters are renderer theme decisions, not spec data.
- Each block carries a `frame`: `{ "x": 0-11, "y": ≥0, "w": 1-12, "h": ≥1 }`
  with `x + w ≤ 12`.
- **No overlap**: two frames may not intersect. Overlap → `REJECT`
  (`LayoutOverlapError {blockIds}`). Gaps are allowed.
- Deterministic paint order: sort by `(y, x)`; the renderer never reorders.
- Responsive collapse below the grid breakpoint is a renderer concern: blocks
  stack in paint order at full width. The spec stores only the 12-col frames.
- LLM guidance (prompt-level, not validated): KPIs 3 wide × 2 tall on the top
  row; tables/boards ≥ 6 wide; charts ≥ 4 wide.

## 4. Block model — config vs binding

```jsonc
{
  "id": "blk_a1",                 // unique within the spec, ^blk_[a-z0-9]+$
  "type": "CasesTable",           // registry name from the block registry
  "frame": { "x": 0, "y": 2, "w": 8, "h": 6 },
  "config": {                     // STATIC presentation — never touches data
    "title": "Overdue high-risk",
    "columns": ["id", "title", "risk", "dueDate"]
  },
  "binding": {                    // DATA — everything that produces rows
    "entity": "case",
    "query": { /* QuerySpec, §5 */ }
  }
}
```

The split is the load-bearing rule of the block model:

- **`config`** is everything that would be identical if the data changed:
  titles, column selection/order, chart kind, sort *presentation* (arrows),
  empty-state copy. Config values are plain JSON literals — never field
  references, never templates, never derived from query results. The
  validator checks config against the block type's **config schema** (a
  narrowed subset of the component's props schema, published by the registry).
- **`binding`** is everything that produces data: the entity, the query, and
  (v1) nothing else. The renderer executes the binding, then merges
  `config + rows` into component props. A block type declares its **binding
  shape** (`rows`, `groups`, or `aggregate`) and the validator checks the
  query's output shape matches (e.g. `GroupedBoard` requires a `groupBy`
  query; `KpiCards` requires `aggregate`).
- A block with no binding (`"binding": null`) is legal for static blocks
  (v1: none in the default registry; the hook exists for headings/notes).

**The alias↔config contract (A1):** the one sanctioned bridge between config
and binding is the **aggregation alias**. A block that presents multiple
metrics references them from config by alias, e.g.

```jsonc
"config": {
  "cards": [
    { "alias": "total", "label": "Open cases" },
    { "alias": "exposure", "label": "Exposure (USD)", "intent": "negative" }
  ]
},
"binding": { "entity": "case", "query": { "aggregations": [
  { "fn": "count", "alias": "total" },
  { "fn": "sum", "field": "amountUsd", "alias": "exposure" }
] } }
```

The validator checks that **every alias referenced in config exists in
`binding.query.aggregations`** → `AliasReferenceError {blockId, alias,
declared[]}`. Aliases that are declared but unreferenced are legal.

Why the split exists: config diffs are safe to auto-apply on edit; binding
diffs re-trigger validation and permission checks. It also keeps the Phase 2
renderer pure — `render(config, data)` with no query knowledge.

## 5. QuerySpec grammar

```jsonc
{
  "filters": [ { "field": "risk", "op": "in", "value": ["high", "critical"] } ],
  "sort":    [ { "field": "dueDate", "dir": "asc" } ],   // 0..3 entries
  "groupBy": "analyst",                                   // optional, single field
  "aggregations": [                                       // optional
    { "fn": "count", "alias": "total" },
    { "fn": "sum", "field": "amountUsd", "alias": "exposure" }
  ],
  "limit": 50                                             // int, 1..contract max
}
```

### Operators by field type

| Field type | Operators |
|---|---|
| `string` | `eq`, `neq`, `contains`, `in`, `not_in` |
| `enum` | `eq`, `neq`, `in`, `not_in` |
| `number` | `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `between` |
| `date` / `datetime` | `on`, `before`, `after`, `between` (all **inclusive**) |
| `boolean` | `eq` |

Rules the validator enforces (each with a typed error):

- Every `field` must be declared `filterable` (resp. `sortable`, `groupable`)
  in the entity contract → `ContractViolationError {blockId, field, allowed[]}`.
- Operator must be legal for the field's contracted type → `OperatorTypeError`.
- `in`/`not_in` values must be non-empty arrays of the field's type.
  **An empty array is a validation error, not "no filter"** — the LLM tool
  layer strips empty-array filters *before* the spec is assembled (Phase 0
  lesson: models emit `[]` for unused filters).
- `aggregations[].fn` ∈ contract's declared aggregations for that field
  (`count` needs no field).

### Output-shape derivation (A2)

The query's output shape is **derived, never declared**:

| `groupBy` | `aggregations` | Output shape |
|---|---|---|
| — | — | `rows` (flat records) |
| — | ✓ | `aggregate` (a single row of aliases) |
| ✓ | — | `groups` (grouped rows; `sort` applies **within** each group) |
| ✓ | ✓ | `aggregate` (one row per group: group key + aliases) |

The validator derives the shape from the query and matches it against the
block type's declared binding shape → `BindingShapeError {blockId, expected,
derived}`.
- `limit` is a **required-bounded** integer: missing → contract default;
  out of `1..max` → `REJECT` (Phase 0 lesson: unbounded `limit: -1` silently
  returned 239/240 rows).

### Date values: typed, normalized, inclusive

- Contract fields are typed `date` (day precision) or `datetime` (instant).
- A `date` field only accepts **date values**; the validator **normalizes** a
  datetime literal sent against a `date` field by truncating to the day and
  records a normalization note (Phase 0 lesson: `dueAfter:
  "2026-07-05T19:32:08Z"` vs date-only `dueDate` silently shifted the
  inclusive boundary).
- All range endpoints are inclusive; `between` is `[start, end]`.

## 6. Relative time — resolved at execution

Date/datetime filter values are either **absolute** or **symbolic**:

```jsonc
{ "field": "dueDate", "op": "between", "value": { "rel": "this_month" } }
{ "field": "dueDate", "op": "before",  "value": { "rel": "today", "offsetDays": 7 } }
{ "field": "dueDate", "op": "after",   "value": { "abs": "2026-07-01" } }
```

- Symbolic tokens v1: `today`, `yesterday`, `tomorrow`, `this_week`,
  `last_week`, `this_month`, `last_month`, `this_quarter`, `this_year`,
  plus `offsetDays: int` applicable to any point token.
- **Symbolic values are stored symbolically and resolved at query execution**
  — a saved "due this month" workspace opened in August shows August. Never
  resolve at generation time.
- Resolution uses **one clock**: the workspace `timezone` field — `"viewer"`
  (default; the reading user's TZ), the alias `"UTC"`, or a pinned IANA zone
  for team-shared boards. Week start is Monday. (Phase 0 shipped two
  disagreeing clocks; centralizing this is why the field exists.)
- **Schema checks shape only (A4)**: the schema accepts `"viewer"`, `"UTC"`,
  and `Area/Location`-shaped strings; whether a zone actually exists is
  enforced at execution via `Intl` — an invalid zone is a typed executor
  error, never a silent UTC fallback.
- Interval refresh does **not** force a pinned zone (Q4): resolution is per
  execution context, and viewer-relative is correct per viewer. Caching
  layers must key on the **resolved date range**, never the symbolic token.
- The LLM must also receive `userTime` context at generation so its *choice*
  of token is right (Phase 0: without it the model guessed the wrong month) —
  but the stored value stays symbolic.

## 7. Block registry (v1)

The six Phase 0 blocks, hardened, are the v1 registry: `CasesTable`,
`KpiCards`, `CaseQueue`, `FilterBar`, `GroupedBoard`, `Graph`. Each registry
entry publishes: `type` name, config schema, binding shape
(`rows | groups | aggregate | none`), and min/max frame size. Unknown `type`
→ `REJECT` (`UnknownBlockTypeError`).

v1 scope note: `FilterBar` binds to sibling blocks by `targets: [blockId]`
in its config; cross-block filter *state* is a renderer concern and does not
round-trip into the saved spec in v1. **Target rules (Q2):** every target id
must exist in the spec, all targets must share one binding entity, and the
FilterBar's configured filter fields must be `filterable` on that entity →
`FilterTargetError {blockId, target, reason}`. Silent no-op filter chips
would violate fail-fast.

## 8. Refresh policy

```jsonc
"refresh": { "mode": "manual" }
"refresh": { "mode": "interval", "seconds": 300 }   // 60..3600
```

Workspace-level only in v1 (per-block refresh is a v2 candidate). `interval`
re-executes bindings only — never re-generation, never LLM involvement.

## 9. Versioning & migration

- `specVersion` is a monotonically increasing integer, `1` for this document.
- Stored specs are **never rewritten in place**. Pure
  `migrate_v{N}_to_v{N+1}(spec)` functions run lazily at read time; the
  chain must always compose to the current version. Old workspaces load
  forever.
- Additive, backward-compatible changes (new optional field with a default)
  do not bump the version; anything that changes meaning does.

## 10. Validation verdicts

`validate(spec, contracts, tenantPolicy) → verdict` — a pure function.

- **BUILD** — spec is fully within contract + policy; renderer may proceed.
- **CLARIFY** — spec is well-formed but under-determined in a way the LLM can
  fix with one more user answer (e.g. ambiguous entity, missing required
  binding). Carries machine-readable questions **and the draft spec as opaque
  resume-context (Q1)** — never rendered, need not validate. Amendment beats
  regeneration: cheaper, stable under the user's answer, and auditable as
  question → answer → diff.
- **REJECT** — contract/policy violation or malformed shape. Carries the typed
  error list; every error names what failed, why, and what is allowed
  (`{blockId, field, allowed[]}` style).

Text-only or empty LLM output (Phase 0's two baseline misses) never reaches
the validator — the generation layer treats "no spec produced" as a retry
with feedback, not a render.

## 11. Worked example — the flagship prompt

*"Show high-risk cases due this month, grouped by analyst"* →

```json
{
  "specVersion": 1,
  "title": "High-risk cases due this month",
  "timezone": "viewer",
  "refresh": { "mode": "manual" },
  "layout": { "columns": 12 },
  "blocks": [
    {
      "id": "blk_kpis",
      "type": "KpiCards",
      "frame": { "x": 0, "y": 0, "w": 12, "h": 2 },
      "config": { "cards": [{ "alias": "total", "label": "High-risk due this month" }] },
      "binding": {
        "entity": "case",
        "query": {
          "filters": [
            { "field": "risk", "op": "in", "value": ["high", "critical"] },
            { "field": "dueDate", "op": "between", "value": { "rel": "this_month" } }
          ],
          "aggregations": [{ "fn": "count", "alias": "total" }]
        }
      }
    },
    {
      "id": "blk_board",
      "type": "GroupedBoard",
      "frame": { "x": 0, "y": 2, "w": 12, "h": 8 },
      "config": { "title": "By analyst" },
      "binding": {
        "entity": "case",
        "query": {
          "filters": [
            { "field": "risk", "op": "in", "value": ["high", "critical"] },
            { "field": "dueDate", "op": "between", "value": { "rel": "this_month" } }
          ],
          "groupBy": "analyst",
          "sort": [{ "field": "riskScore", "dir": "desc" }],
          "limit": 100
        }
      }
    }
  ]
}
```

## 12. Non-goals for v1

- Multi-entity joins or cross-entity blocks (one entity per binding).
- Write-back actions from blocks (view-only workspaces).
- Per-block refresh, computed/derived fields, custom color theming in spec.
- Cross-block filter state persistence (FilterBar state is ephemeral).
- Free-form text/markdown blocks (registry hook exists via `binding: null`).

## 13. Resolved questions (freeze review, 2026-07-07)

1. **CLARIFY payload** → questions **and** the draft spec as opaque
   resume-context (folded into §10).
2. **FilterBar.targets** → validated: exist + one shared entity + filterable
   fields, `FilterTargetError` (folded into §7).
3. **Max blocks** → 24 stays as the v1 cap, tenant-policy overridable
   **downward only**. The Phase 2 hostile-conditions work tests the renderer
   at ~50 blocks ≈ 2× cap — the cap is a policy choice, not a perf cliff.
4. **Timezone × interval refresh** → no forced pinned zone; caching keys on
   the resolved range, not the token (folded into §6). A sharing-time warning
   for `shared + interval + viewer` is Phase 4 UX, not v1 spec law.

---

*Phase 0 lessons embedded above: unbounded limits (§5), empty-array filters
(§5), date vs datetime normalization (§5), two-clocks bug → single timezone
policy (§6), generation-time date guessing → userTime context (§6), streaming
partial props (§1.5), text/empty fallback handling (§10).*
