// A contract whose capability grant names a field the schema does not declare.
// defineEntity throws ContractDefinitionError at module load, which the loader
// surfaces as a ContractLoadError — lint reports it as an error, exit non-zero.
import { z } from "zod";
import { defineEntity } from "@workspace-engine/core";

const caseSchema = z.object({
  id: z.string().describe("Stable case identifier."),
  risk: z.enum(["low", "high"]).describe("Risk tier: low or high."),
});

export const caseContract = defineEntity({
  name: "case",
  schema: caseSchema,
  capabilities: {
    // `sla_deadline` is not a field on the schema -> defineEntity throws.
    filterable: ["risk", "sla_deadline"],
  },
  fetch: async () => [],
});

export default [caseContract];
