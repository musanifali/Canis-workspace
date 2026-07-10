"use client";

import { MessageThreadFull } from "@/components/tambo/message-thread-full";
import { useMcpServers } from "@/components/tambo/mcp-config-modal";
import { useAnonymousUserKey } from "@/lib/use-anonymous-user-key";
import { generatedWorkspaceSchema } from "@/components/workspace/generated-workspace";
import { InteractableGeneratedWorkspace } from "@/components/workspace/interactable-workspace";
import { WorkspaceSaveBar } from "@/components/workspace/save-bar";
import { workspaceGuideContextHelper } from "@/workspace-engine/system-prompt";
import { contractContextHelper } from "@/workspace-engine/agent-tools";
import { contracts } from "@/workspace-engine/kit";
import {
  currentTimeContextHelper,
  TamboProvider,
  type TamboComponent,
} from "@tambo-ai/react";
import { useMemo } from "react";

/**
 * Phase 3 creation surface — natural language → a validated, live workspace
 * (cards #19 + #20; hardened for review P1 #70).
 *
 * The model authors a WorkspaceSpec and renders it as the `spec` prop of
 * GeneratedWorkspace — the ONLY registered component. That component runs the
 * validator gate (validateSpec) before it draws anything: valid → the real
 * renderer; invalid → a message naming what's wrong. So validation still gates
 * every pixel; the LLM emits spec JSON only and can render nothing else.
 *
 * Why render the component directly instead of a proposeWorkspace tool round-trip
 * (the #20 shape): DeepSeek intermittently truncates a large tool-args JSON blob
 * mid-stream, and the pinned client hard-throws on the unparseable args → the
 * user's turn dead-ends (P1 #70). Component props stream as incremental JSON
 * Patch ops, which tolerate a truncated tail (partial spec → "composing…", no
 * crash) — so this path has no dead turn. `proposeWorkspaceTool` still exists for
 * server/non-streaming callers where tool-args are safe; it's just not on the
 * streaming creation loop. The versioned authoring guide rides in as context.
 */
const components: TamboComponent[] = [
  {
    name: "GeneratedWorkspace",
    description:
      "Renders a WorkspaceSpec as a live, data-backed screen. Pass your spec as the `spec` " +
      "prop. It validates the spec against the data contracts first: valid specs render; " +
      "invalid ones show what to fix. This is the only way to put a workspace on screen.",
    component: InteractableGeneratedWorkspace,
    propsSchema: generatedWorkspaceSchema,
  },
];

export default function CreateWorkspace() {
  const mcpServers = useMcpServers();
  const userKey = useAnonymousUserKey();
  // Grounding string from the contracts — the model's source of exact field
  // names/kinds/ops now that no query_* tool carries them (P1 #70).
  const workspaceContracts = useMemo(() => contractContextHelper(contracts), []);

  return (
    <TamboProvider
      apiKey={process.env.NEXT_PUBLIC_TAMBO_API_KEY!}
      components={components}
      tamboUrl={process.env.NEXT_PUBLIC_TAMBO_URL}
      mcpServers={mcpServers}
      userKey={userKey}
      contextHelpers={{
        userTime: currentTimeContextHelper,
        workspaceGuide: workspaceGuideContextHelper,
        workspaceContracts,
      }}
      // DeepSeek's thinking mode rejects the tool_choice the name generator uses.
      autoGenerateThreadName={false}
    >
      <div className="flex h-screen flex-col">
        <WorkspaceSaveBar />
        <MessageThreadFull className="max-w-4xl mx-auto flex-1" />
      </div>
    </TamboProvider>
  );
}
