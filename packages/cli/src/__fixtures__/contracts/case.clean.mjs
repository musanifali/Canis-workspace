// A well-documented `case` contract: entity described, every field described,
// every enum value documented. `contracts lint` should report nothing.
import { z } from "zod";
import { defineEntity } from "@workspace-engine/core";

const caseSchema = z
  .object({
    id: z.string().describe("Stable case identifier assigned at intake."),
    title: z.string().describe("Short human-readable summary of the case."),
    risk: z
      .enum(["low", "high"])
      .describe("Risk tier: low = routine review, high = urgent escalation."),
    status: z.enum(["open", "closed"]).describe("Whether the case is open or closed."),
    analyst: z.string().describe("Name of the analyst who owns the case."),
    amountUsd: z.number().describe("Financial exposure in US dollars."),
  })
  .describe("A compliance case under review by an analyst.");

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
