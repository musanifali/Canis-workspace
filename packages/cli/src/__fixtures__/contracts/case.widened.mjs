// Proposed `case` contract that only ADDS surface (a new `region` field, made
// filterable) and keeps everything else. A purely additive change: no saved
// workspace should break.
import { z } from "zod";
import { defineEntity } from "@workspace-engine/core";

const caseSchema = z.object({
  id: z.string().describe("Stable case identifier assigned at intake."),
  title: z.string().describe("Short human summary of the case."),
  risk: z
    .enum(["low", "medium", "high", "critical"])
    .describe("Risk tier: low, medium, high, or critical exposure."),
  status: z.enum(["open", "closed"]).describe("Whether the case is open or closed."),
  analyst: z.string().describe("Name of the analyst who owns the case."),
  riskScore: z.number().describe("Model risk score from 0 to 100."),
  amountUsd: z.number().describe("Financial exposure in US dollars."),
  dueDate: z.string().describe("Day the case review is due (YYYY-MM-DD)."),
  sla_deadline: z
    .string()
    .describe("Contractual SLA deadline day for resolving the case (YYYY-MM-DD)."),
  region: z.string().describe("Geographic region the case belongs to."),
});

export const caseContract = defineEntity({
  name: "case",
  schema: caseSchema,
  fieldKinds: { dueDate: "date", sla_deadline: "date" },
  capabilities: {
    filterable: ["risk", "status", "analyst", "riskScore", "amountUsd", "dueDate", "sla_deadline", "title", "region"],
    sortable: ["riskScore", "amountUsd", "dueDate", "sla_deadline"],
    groupable: ["risk", "status", "analyst", "region"],
    aggregations: { riskScore: ["avg", "max"], amountUsd: ["sum", "avg"] },
    defaultLimit: 50,
    maxLimit: 200,
  },
  fetch: async () => [],
});

export default [caseContract];
