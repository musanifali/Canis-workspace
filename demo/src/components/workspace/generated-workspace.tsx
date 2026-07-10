"use client";

/**
 * Two-phase generation, Phase B — render the validated spec (card #20).
 *
 * The model renders this component with the spec that `proposeWorkspace`
 * returned as `build`. It mounts the real Workspace Engine (provider + renderer)
 * so the screen the user sees is produced by the exact deterministic read path
 * that /workspaces uses — the LLM contributed a spec, nothing more.
 *
 * Two guards matter. (1) Tambo streams props progressively, so `spec` arrives in
 * pieces; we re-run the gate and only mount the renderer once a complete, valid
 * spec has landed — no flashing of half-built trees. (2) Even on a direct render
 * that skipped proposeWorkspace, the gate here is the same `validateSpec`, so a
 * bad spec degrades to a message instead of a broken workspace. Everything
 * reaches the renderer through validateSpec, by construction.
 */
import { useMemo } from "react";
import { z } from "zod";
import { WorkspaceProvider, WorkspaceRenderer } from "@workspace-engine/react";
import { blocks, contracts, validationContext } from "@/workspace-engine/kit";
import { gatePlan } from "@/workspace-engine/plan-gate";

// Deliberately loose: a WorkspaceSpec's block `config` is a dynamic-key record,
// which Tambo won't accept in a *component* propsSchema (its streaming prop-diff
// needs explicit keys). We don't need the shape here anyway — the model receives
// the validated spec from proposeWorkspace and passes it through, and the gate
// below re-validates it. The full spec schema still shapes proposeWorkspace's
// tool input (tools do allow records).
export const generatedWorkspaceSchema = z.object({
  spec: z
    .any()
    .describe(
      "The WorkspaceSpec returned as 'build' by proposeWorkspace. Pass it through unchanged.",
    ),
});

export function GeneratedWorkspace({ spec }: { spec?: unknown }): React.ReactElement {
  // Re-gate on every prop change; while streaming, `spec` is partial and the
  // gate simply won't say "build" yet.
  const outcome = useMemo(
    () => (spec == null ? null : gatePlan(spec, validationContext)),
    [spec],
  );

  if (outcome?.status === "build") {
    return (
      <div data-testid="generated-workspace" className="w-full">
        <WorkspaceProvider
          apiKey="demo"
          userToken={{ demo: true }}
          contracts={contracts}
          blocks={blocks}
        >
          <WorkspaceRenderer spec={outcome.spec} rowHeight={72} />
        </WorkspaceProvider>
      </div>
    );
  }

  // Streaming or not-yet-valid: a calm placeholder, never a broken tree.
  const note =
    outcome?.status === "reject"
      ? outcome.explanation
      : outcome?.status === "clarify"
        ? outcome.question
        : "Composing workspace…";
  return (
    <div
      data-testid="generated-workspace-pending"
      className="rounded-md border border-black/10 p-4 text-sm text-black/60"
    >
      {note}
    </div>
  );
}
