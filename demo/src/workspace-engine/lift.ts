/**
 * Spec lifting — capture the live workspace as a saveable WorkspaceSpec (card #21).
 *
 * The Phase 3 pipeline (#20/#70) emits the canonical spec directly: the model
 * renders <GeneratedWorkspace spec={...}>, and that spec is already validated,
 * already config/binding-split. So "lifting" is not the props→spec reversal the
 * card originally imagined (that was for a tree of individual interactable
 * blocks) — it is: read the live GeneratedWorkspace interactable from the
 * snapshot, and re-gate its spec so only a workspace that passes the validator
 * is ever persisted.
 *
 * A workspace that is still composing, or whose spec doesn't validate, is
 * "unliftable": save fails fast with a message that says why (card criterion 3),
 * rather than persisting a broken screen.
 */
import type { ValidationContext, WorkspaceSpec } from "@workspace-engine/core";
import { gatePlan } from "./plan-gate";

/** The subset of an interactables-snapshot entry that lifting needs. */
export interface LiftableInteractable {
  name: string;
  props: Record<string, unknown>;
}

export class LiftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LiftError";
  }
}

/** The registered component name the model renders a workspace as (see /create). */
export const WORKSPACE_COMPONENT_NAME = "GeneratedWorkspace";

/**
 * Lift the current live workspace from an interactables snapshot into a spec.
 *
 * @param snapshot `useCurrentInteractablesSnapshot()` output.
 * @param ctx Contracts to validate against (gate ≡ renderer).
 * @returns The validated, normalized spec, ready to persist.
 * @throws {LiftError} When there is nothing to save, the workspace is still
 *         composing, or its spec doesn't pass the validator.
 */
export function liftWorkspaceSpec(
  snapshot: readonly LiftableInteractable[],
  ctx: ValidationContext,
): WorkspaceSpec {
  const workspaces = snapshot.filter((c) => c.name === WORKSPACE_COMPONENT_NAME);
  if (workspaces.length === 0) {
    throw new LiftError("There's no workspace to save yet — generate one first.");
  }

  // The most recently rendered workspace is the one on screen.
  const spec = workspaces[workspaces.length - 1]!.props.spec;
  if (spec == null) {
    throw new LiftError(
      "The workspace is still composing — wait for it to finish, then save.",
    );
  }

  const outcome = gatePlan(spec, ctx);
  if (outcome.status === "build") return outcome.spec;

  // Unliftable: surface exactly why, don't persist a broken screen.
  const why =
    outcome.status === "reject"
      ? outcome.explanation
      : `it needs a clarification first: ${outcome.question}`;
  throw new LiftError(`This workspace can't be saved yet — ${why}`);
}
