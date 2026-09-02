/**
 * The playground's sample contract + seeded rows (#101), defined locally and
 * PURE (defineEntity only) so the server gate can import it without dragging in
 * the UI package's client components. Mirrors @workspace-engine/ui's bundled
 * sample so the rendered result matches what people would get from the SDK.
 */
import { defineEntity } from "@workspace-engine/core";
import { z } from "zod";

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

/** 24 deterministic rows so the sandbox renders identically every time. */
export const SAMPLE_ROWS: SampleRow[] = Array.from({ length: 24 }, (_, i) => ({
  id: `SMP-${100 + i}`,
  name: `Sample item ${i + 1}`,
  status: STATUSES[i % 3]!,
  team: TEAMS[Math.floor(i / 8) % 3]!,
  effort: ((i * 13) % 40) + 5,
  created: `2026-${String((i % 12) + 1).padStart(2, "0")}-15`,
}));

/** Field names + capability lists as plain arrays — the single source for both
 * the contract below AND the model's grounding prompt (defineEntity's result
 * doesn't re-expose these as arrays, so never introspect it for prompt text). */
export const SAMPLE_FIELDS = ["id", "name", "status", "team", "effort", "created"] as const;
export const SAMPLE_CAPS = {
  filterable: ["status", "team", "effort", "name"],
  sortable: ["effort", "created"],
  groupable: ["status", "team"],
} as const;

/** The one contract the gate enforces and the render binds to. */
export const playgroundContract = defineEntity({
  name: "sample",
  schema: sampleSchema,
  fieldKinds: { created: "date" },
  capabilities: {
    filterable: [...SAMPLE_CAPS.filterable],
    sortable: [...SAMPLE_CAPS.sortable],
    groupable: [...SAMPLE_CAPS.groupable],
    aggregations: { effort: ["sum", "avg", "max"] },
    defaultLimit: 50,
    maxLimit: 100,
  },
  fetch: async () => SAMPLE_ROWS,
});
