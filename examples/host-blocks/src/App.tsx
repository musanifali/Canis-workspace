// Registration: map each block type to YOUR component. That's the swap.
//
// `defineBlock` declares what the component can render (`accepts.shape`), which
// is checked against the block registry — so a component wired to the wrong
// data shape fails at registration, not in front of a user.
import { WorkspaceProvider, WorkspaceRenderer, defineBlock } from "@ticora/react";
import type { WorkspaceSpec } from "@ticora/core";
import { issueContract } from "./contract";
import { IssueBoard, IssueTable } from "./blocks";

export const hostBlocks = [
  defineBlock({
    type: "CasesTable",
    accepts: { shape: "rows", entities: ["issue"] },
    component: IssueTable,
  }),
  defineBlock({
    type: "GroupedBoard",
    accepts: { shape: "groups", entities: ["issue"] },
    component: IssueBoard,
  }),
];

export function Workspace({ spec }: { spec: WorkspaceSpec }) {
  return (
    <WorkspaceProvider contracts={[issueContract]} blocks={hostBlocks}>
      <WorkspaceRenderer spec={spec} />
    </WorkspaceProvider>
  );
}
