import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { WorkspaceProvider, WorkspaceRenderer } from "@workspace-engine/react";
import { blocks, contracts } from "./kit";
import { demoWorkspaces } from "./specs";

// Relative-date filters ("overdue", "this month") resolve against the clock at
// fetch time, so these snapshots would drift every day. Pin only Date (leave
// timers real so waitFor still works) to a fixed "today".
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-07-15T12:00:00Z"));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

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
