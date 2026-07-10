"use client";

/**
 * The interactable the model renders on /create (card #21). Wrapping the pure
 * GeneratedWorkspace with withTamboInteractable registers each rendered workspace
 * in the interactables snapshot, so Save can lift its spec —
 * `useCurrentInteractablesSnapshot()` returns it as { name, props.spec }.
 *
 * Kept separate from generated-workspace.tsx so that pure component stays free of
 * `@tambo-ai/react` (which pulls voice/media deps that break the jsdom unit test).
 */
import { withTamboInteractable } from "@tambo-ai/react";
import {
  GeneratedWorkspace,
  generatedWorkspaceSchema,
} from "./generated-workspace";
import { WORKSPACE_COMPONENT_NAME } from "@/workspace-engine/lift";

export const InteractableGeneratedWorkspace = withTamboInteractable(GeneratedWorkspace, {
  componentName: WORKSPACE_COMPONENT_NAME,
  description:
    "Renders a WorkspaceSpec as a live, data-backed screen. Pass the spec as the `spec` prop; " +
    "it validates against the data contracts first (valid → renders, invalid → shows what to fix).",
  propsSchema: generatedWorkspaceSchema,
});
