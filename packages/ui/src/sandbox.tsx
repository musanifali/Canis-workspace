import type { ReactElement } from "react";
import { WorkspaceProvider, WorkspaceRenderer } from "@workspace-engine/react";
import { defaultBlocks } from "./blocks";
import { sampleContract, sampleSpec } from "./sample";

export interface WorkspaceSandboxProps {
  /** Optional platform API key; devMode supplies a placeholder when omitted. */
  apiKey?: string;
  className?: string;
  rowHeight?: number;
}

/**
 * The zero-config devMode sandbox (card #40). Drop it into your app and you get
 * a live, data-backed workspace — no contracts, no blocks, no network — inside
 * your own shell:
 *
 * ```tsx
 * import { WorkspaceSandbox } from "@workspace-engine/ui";
 * export default function Page() {
 *   return <WorkspaceSandbox />;
 * }
 * ```
 *
 * It wires the bundled sample contract + seeded data (devMode) to the default
 * block set. WorkspaceProvider prints a console banner pointing at the next step:
 * define your first entity.
 */
export function WorkspaceSandbox({ apiKey, className, rowHeight = 72 }: WorkspaceSandboxProps): ReactElement {
  return (
    <WorkspaceProvider apiKey={apiKey} devMode contracts={[sampleContract]} blocks={defaultBlocks}>
      <WorkspaceRenderer spec={sampleSpec} className={className} rowHeight={rowHeight} />
    </WorkspaceProvider>
  );
}
