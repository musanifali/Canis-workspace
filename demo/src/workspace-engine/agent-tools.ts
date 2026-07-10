/**
 * Contract-grounded Tambo tools (card #19).
 *
 * The agent's data access is grounded by CONSTRUCTION. `compileToTools` emits,
 * per contract, one `query_<entity>` tool whose input schema admits *only* the
 * queries the contract allows — filter variants exist solely for (filterable
 * field × op-legal-for-its-kind), sort/groupBy enums hold only allowed fields,
 * aggregation variants only granted fn/field pairs, limit capped at maxLimit.
 * So the model can reference only contracted entities and fields; a hallucinated
 * field isn't a runtime surprise, it's unrepresentable in the tool call.
 *
 * `compileToExecutor` closes the loop at call time: it re-validates the query
 * against the same contract, applies the default limit, runs the vendor `fetch`
 * with the end user's auth UNCHANGED (ADR-4), then runs the client-side query
 * engine over the returned rows. Nothing here re-describes the contract by hand,
 * so the tool the model sees and the policy the executor enforces cannot drift.
 *
 * `@workspace-engine/core` stays free of `@tambo-ai` by charter — this adapter,
 * living in the demo (the vendor app), is the only place the two meet.
 */
import {
  compileToExecutor,
  compileToTools,
  type EntityContract,
  type ValidationContext,
} from "@workspace-engine/core";
import type { TamboTool } from "@tambo-ai/react";
import { z } from "zod";
import { gatePlan } from "./plan-gate";

/** Query results are rows, groups, or aggregate objects — all keyed records. */
const queryResultSchema = z.array(z.record(z.string(), z.unknown()));

/**
 * Adapt data contracts into Tambo tools the agent loop can call.
 *
 * @param contracts The vendor's `defineEntity` contracts (grounds the model).
 * @param auth Passed straight through to the vendor executor on every call —
 *             the end user's credentials, never ours. Defaults to `undefined`
 *             for the demo's in-memory fetch, which ignores it.
 */
export function toGroundedTools(
  contracts: readonly EntityContract[],
  auth: unknown = undefined,
): TamboTool[] {
  return contracts.flatMap((contract) => {
    const execute = compileToExecutor(contract);
    return compileToTools(contract).map(
      (compiled): TamboTool => ({
        name: compiled.name,
        description: compiled.description,
        // A zod schema is Standard-Schema compliant; Tambo parses the model's
        // arguments against it before calling `tool`, so `query` is contract-safe.
        inputSchema: compiled.inputSchema,
        outputSchema: queryResultSchema,
        tool: async (query: unknown) =>
          execute({ query: query as Parameters<typeof execute>[0]["query"], auth }),
      }),
    );
  });
}

/**
 * Two-phase generation, Phase A as a Tambo tool (card #20).
 *
 * The model calls this with its candidate WorkspaceSpec (the "plan") BEFORE
 * rendering anything. The tool runs the pure validator gate and returns one of
 * three verdicts:
 *   - build   → the normalized spec; the model then renders <GeneratedWorkspace>.
 *   - clarify → one targeted question the model relays to the user (no UI).
 *   - reject  → a contract-referencing explanation the model relays (no UI).
 *
 * So a hallucinated field never reaches the screen — it comes back as a tool
 * result the model answers in words. The input schema is the real spec schema,
 * which both shapes the model's plan and lets Tambo pre-parse it; the gate's
 * `validateSpec` is still the single authority on contracts and policy.
 */
export function proposeWorkspaceTool(ctx: ValidationContext): TamboTool {
  return {
    name: "proposeWorkspace",
    description:
      "Validate a candidate WorkspaceSpec against the data contracts BEFORE rendering. " +
      "Always call this first with your full spec. Returns { status }: 'build' with the " +
      "spec to render, 'clarify' with one question to ask the user, or 'reject' with an " +
      "explanation to relay. Never render a workspace you have not validated here.",
    // A WorkspaceSpec block's `config` is a dynamic-key record, which Tambo
    // won't accept in a tool inputSchema. So the spec rides as a described `any`
    // and the gate's `validateSpec` (below) is the real, precise contract check.
    inputSchema: z.object({
      spec: z
        .any()
        .describe(
          'A complete WorkspaceSpec. Shape: { "specVersion": 1, "title": string, ' +
            '"blocks": [ { "id": string, "type": "CasesTable"|"KpiCards"|"CaseQueue"|' +
            '"FilterBar"|"GroupedBoard"|"Graph", "frame": { "x","y","w","h": number }, ' +
            '"config": object, "binding": { "entity": string, "query": { "filters": [], ' +
            '"sort": [], "groupBy"?, "aggregations"? } } | null } ] }. Blocks must not overlap.',
        ),
    }),
    outputSchema: z.object({
      status: z.enum(["build", "clarify", "reject"]),
      spec: z.unknown().optional(),
      question: z.string().optional(),
      options: z.array(z.string()).optional(),
      explanation: z.string().optional(),
    }),
    tool: async ({ spec }: { spec: unknown }) => {
      const outcome = gatePlan(spec, ctx);
      switch (outcome.status) {
        case "build":
          return { status: "build" as const, spec: outcome.spec };
        case "clarify":
          return {
            status: "clarify" as const,
            question: outcome.question,
            ...(outcome.options ? { options: outcome.options } : {}),
          };
        case "reject":
          return { status: "reject" as const, explanation: outcome.explanation };
      }
    },
  };
}
