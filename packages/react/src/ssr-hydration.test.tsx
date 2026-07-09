import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { hydrateRoot } from "react-dom/client";
import { act } from "@testing-library/react";
import { parseSpec } from "@workspace-engine/core";
import { WorkspaceRenderer } from "./renderer/WorkspaceRenderer";
import type { BlockComponentProps } from "./renderer/types";

/**
 * "SSR-compatible" is a claim that regresses silently (card #42). This mirrors
 * what Next.js does with a Server Component page: render the SDK to HTML on the
 * server, then hydrate it on the client — and fail if React reports any
 * hydration mismatch. Uses a static spec so server and client output are
 * deterministic (bound blocks would be skeletons on both sides anyway).
 */

function Card({ block }: BlockComponentProps) {
  return <div data-testid="card">{block.id}</div>;
}
const components = { Note: Card };

const spec = parseSpec({
  specVersion: 1,
  title: "SSR check",
  blocks: [
    { id: "blk_1", type: "Note", frame: { x: 0, y: 0, w: 6, h: 2 }, binding: null },
    { id: "blk_2", type: "Note", frame: { x: 6, y: 0, w: 6, h: 2 }, binding: null },
  ],
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("SSR + hydration smoke", () => {
  it("server-renders to HTML with no window access", () => {
    const html = renderToString(<WorkspaceRenderer spec={spec} components={components} />);
    expect(html).toContain("data-workspace-grid");
    expect(html).toContain("blk_1");
    expect(html).toContain("blk_2");
  });

  it("hydrates the server HTML with no mismatch warnings", async () => {
    const app = <WorkspaceRenderer spec={spec} components={components} />;
    const container = document.createElement("div");
    container.innerHTML = renderToString(app);
    document.body.appendChild(container);

    const errors: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...args) => {
      errors.push(args.map(String).join(" "));
    });

    await act(async () => {
      hydrateRoot(container, app);
    });

    const hydrationWarnings = errors.filter((e) => /hydrat|did not match|mismatch/i.test(e));
    expect(hydrationWarnings).toEqual([]);
    expect(container.querySelectorAll('[data-testid="card"]')).toHaveLength(2);
    spy.mockRestore();
  });
});
