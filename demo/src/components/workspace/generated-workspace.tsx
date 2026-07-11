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
import { useEffect, useMemo } from "react";
import { z } from "zod";
import { WorkspaceProvider, WorkspaceRenderer } from "@workspace-engine/react";
import { blocks, contracts, validationContext } from "@/workspace-engine/kit";
import { gatePlan } from "@/workspace-engine/plan-gate";
import { specPropSchema } from "@/workspace-engine/spec-prop-schema";
import { ClarifyNotice, RejectNotice } from "./notices";

// A STRUCTURED schema (explicit keys, Tambo-safe) is what makes the model emit a
// valid-shape spec reliably — a permissive `any` left first-attempt validity
// ~40% (P1 #70). validateSpec (in the gate below) remains the deep authority on
// contracts; this schema just constrains the shape the model generates.
export const generatedWorkspaceSchema = z.object({
  spec: specPropSchema.describe(
    "The WorkspaceSpec to render. Use the exact entity/field names and per-kind operators from the contracts context.",
  ),
});

export function GeneratedWorkspace({ spec }: { spec?: unknown }): React.ReactElement {
  // Re-gate on every prop change; while streaming, `spec` is partial and the
  // gate simply won't say "build" yet (gatePlan strips stray top-level keys).
  const outcome = useMemo(
    () => (spec == null ? null : gatePlan(spec, validationContext)),
    [spec],
  );

  // Eval hook (#22): expose the last built spec (for assertions) and the last
  // gate outcome (for diagnosing no-builds). Harmless; never read by app logic.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as unknown as { __weLastSpec?: unknown; __weLastGate?: unknown };
    if (outcome?.status === "build") w.__weLastSpec = outcome.spec;
    w.__weLastGate = {
      status: outcome?.status ?? "null",
      codes: outcome?.status === "reject" ? outcome.errors.map((e) => e.code) : [],
      paths:
        outcome?.status === "reject"
          ? outcome.errors.map((e) => ("path" in e ? e.path : e.code)).slice(0, 8)
          : [],
      spec,
    };
  }, [outcome, spec]);

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

  // A spec prop arrives incrementally (JSON Patch), so mid-stream it's shape-
  // incomplete — a missing id/version is "still composing", not a real problem.
  // Only a SEMANTIC reject (unknown field, unsupported grouping) on an otherwise
  // shape-complete spec is worth surfacing as a reject to the user (card #23).
  const isStructuralOnly =
    outcome?.status === "reject" &&
    outcome.errors.every(
      (e) => e.code === "SpecShapeError" || e.code === "SpecVersionError",
    );

  if (outcome?.status === "reject" && !isStructuralOnly) {
    return (
      <div data-testid="generated-workspace-pending" className="w-full">
        <RejectNotice explanation={outcome.explanation} errors={outcome.errors} />
      </div>
    );
  }
  if (outcome?.status === "clarify") {
    return (
      <div data-testid="generated-workspace-pending" className="w-full">
        <ClarifyNotice question={outcome.question} options={outcome.options} />
      </div>
    );
  }
  // Streaming / structurally-incomplete: a calm placeholder, never a broken tree.
  return (
    <div
      data-testid="generated-workspace-pending"
      className="rounded-md border border-black/10 p-4 text-sm text-black/60"
    >
      Composing workspace…
    </div>
  );
}
