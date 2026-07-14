# Ticket #80 — visual QA before/after (1440px, real 240-case data)

Screenshots from the Demo Polish visual-QA pass on the six
`@workspace-engine/ui` default blocks. Captured via a throwaway QA harness
route that rendered all six blocks against the real case contract, then
deleted (only the `--we-*` token tuning in `demo/src/app/globals.css` shipped).

- `table-before.jpg` — CasesTable at `--we-font-size: 13px` / `--we-pad: 8px`:
  IDs, ISO dates, customer names, and analyst names all wrap to 2–3 lines →
  tall, cramped rows.
- `table-after.jpg` — same table at the tuned `12px` / `6px`: customer names
  and single-word columns now fit on one line; rows are denser and calmer.
- `all-blocks-after.jpg` — all six blocks (FilterBar, KpiCards, Graph,
  CaseQueue, GroupedBoard, CasesTable) at the tuned tokens, showing the
  consistent Canis look across the set.

Known residual (block-source, not a demo token lever, flagged for a product
card): the Table still wraps `CASE-####` IDs and ISO dates at the hyphen —
fixing needs `white-space`/column-width control inside the Table component.
