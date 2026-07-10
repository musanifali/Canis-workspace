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
} from "@workspace-engine/core";
import type { TamboTool } from "@tambo-ai/react";
import { z } from "zod";

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
