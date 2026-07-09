/**
 * Bundled sample for devMode (card #40): a self-contained contract + seeded data
 * + a hand-written spec, so a developer sees a live screen inside their own app
 * shell before writing a single contract or hitting any network. Nothing here
 * touches the network — the "vendor fetch" just returns the seeded rows.
 */
import { z } from "zod";
import { defineEntity, parseSpec, type WorkspaceSpec } from "@workspace-engine/core";

const STATUSES = ["todo", "in_progress", "done"] as const;
const TEAMS = ["alpha", "beta", "gamma"] as const;

const sampleSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(STATUSES),
  team: z.enum(TEAMS),
  effort: z.number(),
  created: z.string(),
});
export type SampleRow = z.infer<typeof sampleSchema>;

/** 24 deterministic rows — no randomness, so the sandbox renders identically. */
export const SAMPLE_ROWS: SampleRow[] = Array.from({ length: 24 }, (_, i) => ({
  id: `SMP-${100 + i}`,
  name: `Sample item ${i + 1}`,
  status: STATUSES[i % 3]!,
  team: TEAMS[Math.floor(i / 8) % 3]!,
  effort: ((i * 13) % 40) + 5,
  created: `2026-${String((i % 12) + 1).padStart(2, "0")}-15`,
}));

/** A ready-to-use contract over the seeded rows — pass as `contracts={[sampleContract]}`. */
export const sampleContract = defineEntity({
  name: "sample",
  schema: sampleSchema,
  fieldKinds: { created: "date" },
  capabilities: {
    filterable: ["status", "team", "effort", "name"],
    sortable: ["effort", "created"],
    groupable: ["status", "team"],
    aggregations: { effort: ["sum", "avg", "max"] },
    defaultLimit: 50,
    maxLimit: 100,
  },
  fetch: async () => SAMPLE_ROWS,
});

/** A decent-looking hand-written workspace over the sample contract. */
export const sampleSpec: WorkspaceSpec = parseSpec({
  specVersion: 1,
  title: "Sample workspace",
  timezone: "UTC",
  blocks: [
    {
      id: "blk_kpi",
      type: "KpiCards",
      frame: { x: 0, y: 0, w: 12, h: 2 },
      config: {
        cards: [
          { alias: "count", label: "Items" },
          { alias: "avg_effort", label: "Avg effort" },
          { alias: "total_effort", label: "Total effort" },
        ],
      },
      binding: {
        entity: "sample",
        query: {
          aggregations: [
            { fn: "count", alias: "count" },
            { fn: "avg", field: "effort", alias: "avg_effort" },
            { fn: "sum", field: "effort", alias: "total_effort" },
          ],
        },
      },
    },
    {
      id: "blk_table",
      type: "CasesTable",
      frame: { x: 0, y: 2, w: 6, h: 6 },
      config: { title: "All items" },
      binding: { entity: "sample", query: { sort: [{ field: "effort", dir: "desc" }], limit: 20 } },
    },
    {
      id: "blk_board",
      type: "GroupedBoard",
      frame: { x: 6, y: 2, w: 6, h: 6 },
      config: { title: "By status" },
      binding: { entity: "sample", query: { groupBy: "status" } },
    },
  ],
});
