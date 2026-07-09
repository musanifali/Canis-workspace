import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { WorkspaceProvider, WorkspaceRenderer } from "@workspace-engine/react";
import { blocks, contracts } from "./kit";
import { demoWorkspaces } from "./specs";

afterEach(cleanup);

describe("demo workspaces render live against the case contract", () => {
  for (const workspace of demoWorkspaces) {
    it(`renders "${workspace.label}" to a stable, healthy tree`, async () => {
      const { container } = render(
        <WorkspaceProvider apiKey="test" userToken={{}} contracts={contracts} blocks={blocks}>
          <WorkspaceRenderer spec={workspace.spec} />
        </WorkspaceProvider>,
      );

      // Every block loads healthy: no drift/validation broken states, no skeletons left.
      await waitFor(() => {
        expect(container.querySelector("[data-workspace-broken-block]")).toBeNull();
        expect(container.querySelector("[data-workspace-skeleton]")).toBeNull();
        // At least one real @workspace-engine/ui block body rendered.
        expect(container.querySelector('[data-testid^="ui-"]')).not.toBeNull();
      });

      expect(container.querySelector("[data-workspace-grid]")).not.toBeNull();
      expect(container.innerHTML).toMatchSnapshot();
    });
  }

  it("renders the expected block types per spec", async () => {
    const { container } = render(
      <WorkspaceProvider apiKey="test" userToken={{}} contracts={contracts} blocks={blocks}>
        <WorkspaceRenderer spec={demoWorkspaces[0]!.spec} />
      </WorkspaceProvider>,
    );
    await waitFor(() => expect(container.querySelector('[data-testid="ui-kpis"]')).not.toBeNull());
    expect(container.querySelector('[data-testid="ui-table"]')).not.toBeNull();
  });
});
