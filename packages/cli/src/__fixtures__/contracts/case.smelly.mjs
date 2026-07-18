// A `case` contract seeded with one of each quality smell lint must catch:
//   - no entity-level description        -> missing_entity_description
//   - `id`, `amountUsd` lack descriptions -> missing_field_description (x2)
//   - `title` description is vague        -> vague_field_description
//   - `risk` enum values undocumented     -> enum_value_undocumented (low, high)
// It is a STRUCTURALLY VALID contract (defineEntity does not throw), so all
// findings are warnings — the smells that make generation quality poor without
// breaking anything.
import { z } from "zod";
import { defineEntity } from "@workspace-engine/core";

const caseSchema = z.object({
  id: z.string(),
  title: z.string().describe("data"),
  risk: z.enum(["low", "high"]).describe("The overall classification for this case."),
  status: z.enum(["open", "closed"]).describe("Whether the case is open or closed."),
  analyst: z.string().describe("Name of the analyst who owns the case."),
  amountUsd: z.number(),
});

export const caseContract = defineEntity({
  name: "case",
  schema: caseSchema,
  capabilities: {
    filterable: ["risk", "status", "analyst", "amountUsd", "title"],
    sortable: ["amountUsd"],
    groupable: ["risk", "status"],
    aggregations: { amountUsd: ["sum", "avg"] },
  },
  fetch: async () => [],
});

export default [caseContract];
