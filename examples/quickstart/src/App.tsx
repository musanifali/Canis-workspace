// Step 3 — mount the provider once, then any validated spec renders.
// defaultBlocks is the complete built-in block set; swap components later,
// one block at a time.
import { WorkspaceProvider, WorkspaceRenderer } from "@workspace-engine/react";
import { defaultBlocks } from "@workspace-engine/ui";
import { ticketContract } from "./contract";
import { ticketBoardSpec } from "./spec";

export default function App({ userToken }: { userToken: string }) {
  return (
    <WorkspaceProvider
      apiKey="qs-local"
      userToken={userToken}
      contracts={[ticketContract]}
      blocks={defaultBlocks}
    >
      <WorkspaceRenderer spec={ticketBoardSpec} />
    </WorkspaceProvider>
  );
}
