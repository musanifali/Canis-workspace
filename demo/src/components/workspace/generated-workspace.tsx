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
import { specPropSchema } from "@/workspace-engine/spec-prop-schema";

// A STRUCTURED schema (explicit keys, Tambo-safe) is what makes the model emit a
// valid-shape spec reliably — a permissive `any` left first-attempt validity
// ~40% (P1 #70). validateSpec (in the gate below) remains the deep authority on
// contracts; this schema just constrains the shape the model generates.
export const generatedWorkspaceSchema = z.object({
  spec: specPropSchema.describe(
    "The WorkspaceSpec to render. Use the exact entity/field names and per-kind operators from the contracts context.",
  ),
});

/** Top-level keys the spec root accepts; anything else the strict schema rejects. */
const SPEC_ROOT_KEYS = ["specVersion", "title", "timezone", "refresh", "layout", "blocks"];

/** Drop stray top-level keys a model may add (the spec root is `.strict()`). */
function stripSpecRoot(spec: unknown): unknown {
  if (spec == null || typeof spec !== "object" || Array.isArray(spec)) return spec;
  const src = spec as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of SPEC_ROOT_KEYS) if (k in src) out[k] = src[k];
  return out;
}

export function GeneratedWorkspace({ spec }: { spec?: unknown }): React.ReactElement {
  // Re-gate on every prop change; while streaming, `spec` is partial and the
  // gate simply won't say "build" yet. First strip any extra top-level keys the
  // model added (the spec root is .strict(), so a stray "description"/"id" would
  // fail an otherwise-fine spec) — harmless normalization, not hiding an error.
  const outcome = useMemo(
    () => (spec == null ? null : gatePlan(stripSpecRoot(spec), validationContext)),
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
  // A spec prop arrives incrementally (JSON Patch), so mid-stream it's shape-
  // incomplete — a missing id/version is "still composing", not a real problem.
  // Only a SEMANTIC reject (unknown field, unsupported grouping) on an otherwise
  // shape-complete spec is worth surfacing to the user.
  const isStructuralOnly =
    outcome?.status === "reject" &&
    outcome.errors.every(
      (e) => e.code === "SpecShapeError" || e.code === "SpecVersionError",
    );
  const note =
    outcome?.status === "reject" && !isStructuralOnly
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
