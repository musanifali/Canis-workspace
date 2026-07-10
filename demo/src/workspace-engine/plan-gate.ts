/**
 * Two-phase generation, Phase A — the validator gate (card #20).
 *
 * The model authors a candidate WorkspaceSpec (the "plan") and it passes
 * through here BEFORE any UI streams. `validateSpec` is the single source of
 * truth — shape, registry, contracts, and tenant policy all in one pass — so a
 * hallucinated field or an illegal op is caught while the screen is still blank,
 * never half-rendered in front of the user.
 *
 * The three verdicts become three product actions:
 *   - BUILD    → hand the (normalized) spec to Phase B to render.
 *   - CLARIFY  → ask the user ONE targeted question; the opaque draft rides
 *                along for amendment but is never rendered.
 *   - REJECT   → explain, in the contract's own terms, what the vendor's data
 *                model does not support — so the user learns the boundary, not
 *                just that "something failed".
 *
 * Pure and synchronous: no model call, no IO. That is what lets Phase A sit
 * inside the plan latency budget (the model's generation is the only slow part).
 */
import {
  validateSpec,
  type ClarifyQuestion,
  type SpecValidationError,
  type ValidationContext,
  type WorkspaceSpec,
} from "@workspace-engine/core";

/** Top-level keys the spec root accepts; anything else its strict schema rejects. */
const SPEC_ROOT_KEYS = ["specVersion", "title", "timezone", "refresh", "layout", "blocks"];

/**
 * Drop stray top-level keys before gating. The spec root is `.strict()`, so a
 * model that adds "description"/"id"/etc. would fail an otherwise-valid spec.
 * Harmless normalization applied uniformly (render gate + save/lift), not a way
 * to hide errors — nested shape/contract problems still reach validateSpec.
 */
export function stripSpecRoot(spec: unknown): unknown {
  if (spec == null || typeof spec !== "object" || Array.isArray(spec)) return spec;
  const src = spec as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of SPEC_ROOT_KEYS) if (k in src) out[k] = src[k];
  return out;
}

export type PlanOutcome =
  | { status: "build"; spec: WorkspaceSpec }
  | {
      status: "clarify";
      question: string;
      options?: readonly string[];
      /** Opaque resume-context for amendment (Q1) — never rendered. */
      draft: unknown;
    }
  | {
      status: "reject";
      explanation: string;
      errors: readonly SpecValidationError[];
    };

/**
 * Gate a candidate spec (the model's plan) against the contracts.
 *
 * @param candidate Raw spec object or JSON string emitted by the model.
 * @param ctx Contracts (+ optional registry/policy) to validate against.
 */
export function gatePlan(
  candidate: unknown,
  ctx: ValidationContext,
): PlanOutcome {
  const verdict = validateSpec(stripSpecRoot(candidate), ctx);

  if (verdict.verdict === "BUILD") {
    return { status: "build", spec: verdict.spec };
  }

  if (verdict.verdict === "CLARIFY") {
    // One targeted question. validateSpec can surface several (one per
    // under-determined block); the loop asks them one at a time so the user is
    // never faced with a form. The rest resurface on the next pass.
    const q: ClarifyQuestion = verdict.questions[0]!;
    return {
      status: "clarify",
      question: q.question,
      ...(q.options ? { options: q.options } : {}),
      draft: verdict.draft,
    };
  }

  return {
    status: "reject",
    explanation: explainRejection(verdict.errors),
    errors: verdict.errors,
  };
}

/**
 * Compose a user-facing rejection that references the contract. Each validator
 * error already carries a `message` (what failed, naming the entity/field) and
 * a `fix` (what IS allowed — the contract's filterable fields, legal ops, block
 * types, …). We join them so the explanation teaches the boundary. Deduped and
 * capped so a spec with many faults doesn't produce a wall of text.
 */
function explainRejection(errors: readonly SpecValidationError[]): string {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const err of errors) {
    const line = `${err.message} — ${err.fix}`;
    if (seen.has(line)) continue;
    seen.add(line);
    lines.push(line);
    if (lines.length === 4) break;
  }
  const more = errors.length - lines.length;
  const suffix = more > 0 ? `\n(+${more} more issue${more === 1 ? "" : "s"})` : "";
  return `I can't build that against this data model:\n- ${lines.join("\n- ")}${suffix}`;
}
