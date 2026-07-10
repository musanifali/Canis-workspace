"use client";

import { MessageThreadFull } from "@/components/tambo/message-thread-full";
import { useMcpServers } from "@/components/tambo/mcp-config-modal";
import { components } from "@/lib/tambo";
import { useAnonymousUserKey } from "@/lib/use-anonymous-user-key";
import { contracts } from "@/workspace-engine/kit";
import { toGroundedTools } from "@/workspace-engine/agent-tools";
import { workspaceGuideContextHelper } from "@/workspace-engine/system-prompt";
import { currentTimeContextHelper, TamboProvider } from "@tambo-ai/react";
import { useMemo } from "react";

/**
 * Phase 3 creation surface (card #19): natural language → a live workspace.
 *
 * The difference from /chat is grounding. Instead of hand-written tools whose
 * descriptions can drift from what the data actually allows, the agent is given
 * `toGroundedTools(contracts)` — query_* tools compiled straight from the case
 * contract, so the model can only reference contracted entities and fields. The
 * versioned authoring instructions ride in as an AdditionalContext helper. The
 * registered blocks stream in as interactables as the agent composes the screen.
 *
 * (Two-phase plan→validate→stream of a real WorkspaceSpec is card #20; this card
 * lands the grounded loop + versioned prompt + the streaming creation UX.)
 */
export default function CreateWorkspace() {
  const mcpServers = useMcpServers();
  const userKey = useAnonymousUserKey();
  // Contracts are module constants; compile the grounded tools once.
  const tools = useMemo(() => toGroundedTools(contracts), []);

  return (
    <TamboProvider
      apiKey={process.env.NEXT_PUBLIC_TAMBO_API_KEY!}
      components={components}
      tools={tools}
      tamboUrl={process.env.NEXT_PUBLIC_TAMBO_URL}
      mcpServers={mcpServers}
      userKey={userKey}
      // Relative dates ("this month", "overdue") resolve against real time, and
      // the versioned workspace-authoring guide grounds behavior — both delivered
      // as AdditionalContext (the SDK's sanctioned client-side channel).
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
