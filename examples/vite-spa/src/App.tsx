import { WorkspaceProvider, WorkspaceRenderer } from "@workspace-engine/react";
import { defaultBlocks } from "@workspace-engine/ui";
import { ticketContract, triageSpec } from "./workspace";

export function App() {
  return (
    <WorkspaceProvider
      apiKey="vite-spa-local"
      userToken="demo-user"
      contracts={[ticketContract]}
      blocks={defaultBlocks}
    >
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem" }}>
        <h1 style={{ fontSize: "1.25rem" }}>Canis — Vite SPA example</h1>
        <WorkspaceRenderer spec={triageSpec} />
      </main>
    </WorkspaceProvider>
  );
}
