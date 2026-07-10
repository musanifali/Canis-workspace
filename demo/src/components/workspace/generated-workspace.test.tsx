import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { GeneratedWorkspace } from "./generated-workspace";
import { demoWorkspaces } from "@/workspace-engine/specs";

afterEach(cleanup);

describe("GeneratedWorkspace — Phase B renders only a gated spec (card #20)", () => {
  it("renders the real renderer for a valid (build) spec", async () => {
    const { container } = render(
      <GeneratedWorkspace spec={demoWorkspaces[0]!.spec} />,
    );
    await waitFor(() => {
      expect(container.querySelector("[data-testid='generated-workspace']")).not.toBeNull();
      // A real @workspace-engine/ui block body rendered, healthy.
      expect(container.querySelector('[data-testid^="ui-"]')).not.toBeNull();
      expect(container.querySelector("[data-workspace-broken-block]")).toBeNull();
    });
  });

  it("renders despite a stray top-level key the model added (root-strip, P1 #70)", async () => {
    // The spec root is .strict(); a model that adds "description" would otherwise
    // fail an otherwise-valid spec. stripSpecRoot drops it before the gate.
    const specWithExtra = { ...demoWorkspaces[0]!.spec, description: "extra field" };
    const { container } = render(<GeneratedWorkspace spec={specWithExtra} />);
    await waitFor(() => {
      expect(container.querySelector("[data-testid='generated-workspace']")).not.toBeNull();
      expect(container.querySelector('[data-testid^="ui-"]')).not.toBeNull();
    });
  });

  it("shows a pending placeholder (not a broken tree) while the spec is absent/streaming", () => {
    const { container } = render(<GeneratedWorkspace spec={undefined} />);
    expect(
      container.querySelector("[data-testid='generated-workspace-pending']"),
    ).not.toBeNull();
    expect(container.querySelector("[data-testid='generated-workspace']")).toBeNull();
  });

  it("surfaces the contract explanation instead of rendering an invalid spec", () => {
    const badSpec = {
      specVersion: 1,
      title: "Bad",
      blocks: [
        {
          id: "blk_a",
          type: "CasesTable",
          frame: { x: 0, y: 0, w: 12, h: 6 },
          config: {},
          binding: {
            entity: "case",
            query: { filters: [{ field: "nonexistent", op: "eq", value: "x" }] },
          },
        },
      ],
    };
    const { container, getByTestId } = render(<GeneratedWorkspace spec={badSpec} />);
    expect(container.querySelector("[data-testid='generated-workspace']")).toBeNull();
    expect(getByTestId("generated-workspace-pending").textContent).toMatch(/nonexistent/);
  });
});
