"use client";

import { MessageThreadFull } from "@/components/tambo/message-thread-full";
import { useMcpServers } from "@/components/tambo/mcp-config-modal";
import { useAnonymousUserKey } from "@/lib/use-anonymous-user-key";
import {
  GeneratedWorkspace,
  generatedWorkspaceSchema,
} from "@/components/workspace/generated-workspace";
import { contracts, validationContext } from "@/workspace-engine/kit";
import { proposeWorkspaceTool, toGroundedTools } from "@/workspace-engine/agent-tools";
import { workspaceGuideContextHelper } from "@/workspace-engine/system-prompt";
import {
  currentTimeContextHelper,
  TamboProvider,
  type TamboComponent,
} from "@tambo-ai/react";
import { useMemo } from "react";

/**
 * Phase 3 creation surface — natural language → a validated, live workspace
 * (cards #19 + #20). The two-phase loop:
 *
 *   1. The model authors a WorkspaceSpec and calls `proposeWorkspace`, which
 *      runs the validator gate (Phase A) — clarify/reject are caught here, while
 *      the screen is still blank.
 *   2. On "build" the model renders <GeneratedWorkspace>, the ONLY registered
 *      component, which mounts the real renderer over the validated spec
 *      (Phase B). The LLM emits spec JSON only; it cannot render anything else.
 *
 * The grounded `query_*` tools (#19) stay available so the model can inspect
 * what data exists while reasoning — but they can't put pixels on screen. The
 * versioned authoring guide rides in as an AdditionalContext helper.
 */
const components: TamboComponent[] = [
  {
    name: "GeneratedWorkspace",
    description:
      "Renders a validated WorkspaceSpec as a live, data-backed screen. Only render this " +
      "after proposeWorkspace returns status 'build', passing that spec through unchanged.",
    component: GeneratedWorkspace,
    propsSchema: generatedWorkspaceSchema,
  },
];

export default function CreateWorkspace() {
  const mcpServers = useMcpServers();
  const userKey = useAnonymousUserKey();
  const tools = useMemo(
    () => [...toGroundedTools(contracts), proposeWorkspaceTool(validationContext)],
    [],
  );

  return (
    <TamboProvider
      apiKey={process.env.NEXT_PUBLIC_TAMBO_API_KEY!}
      components={components}
      tools={tools}
      tamboUrl={process.env.NEXT_PUBLIC_TAMBO_URL}
      mcpServers={mcpServers}
      userKey={userKey}
      contextHelpers={{
        userTime: currentTimeContextHelper,
        workspaceGuide: workspaceGuideContextHelper,
      }}
      // DeepSeek's thinking mode rejects the tool_choice the name generator uses.
      autoGenerateThreadName={false}
    >
      <div className="h-screen">
        <MessageThreadFull className="max-w-4xl mx-auto" />
      </div>
    </TamboProvider>
  );
}
