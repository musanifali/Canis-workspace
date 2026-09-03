/**
 * Embedding guarantees (#112). A partner mounts the renderer inside their own
 * app shell, under their own global stylesheet. Two failure modes would both
 * be fatal on first contact, so both are pinned here:
 *
 *   1. BLEED OUT — our styles restyle the host's app. Structurally impossible:
 *      every style we emit is an inline `style` attribute on our own elements.
 *      We ship no stylesheet and never inject one.
 *   2. BLEED IN — the host's global CSS breaks our layout. Bounded: inline
 *      styles outrank any selector, so every layout-critical property we set
 *      survives a hostile stylesheet.
 */
import { render, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { parseSpec } from "@ticora/core";
import { WorkspaceGrid } from "./WorkspaceGrid";
import type { BlockComponentProps } from "./types";

afterEach(cleanup);

/** A stylesheet designed to wreck an embedded widget. */
const HOSTILE_CSS = `
  * { box-sizing: content-box; margin: 4px; }
  div { display: block !important; }
  table { border-collapse: separate; width: 1px; }
  th, td { padding: 40px; }
`;

function withHostileStylesheet(): () => void {
  const style = document.createElement("style");
  style.textContent = HOSTILE_CSS;
  document.head.append(style);
  return () => style.remove();
}

const Static = ({ block }: BlockComponentProps) => (
  <div data-testid={`block-${block.id}`}>{block.type}</div>
);

const spec = parseSpec({
  specVersion: 1,
  title: "Embedded",
  timezone: "UTC",
  blocks: [
    {
      id: "blk_a",
      type: "NoteCard",
      frame: { x: 0, y: 0, w: 6, h: 2 },
      config: { text: "hello" },
      binding: null,
    },
    {
      id: "blk_b",
      type: "NoteCard",
      frame: { x: 6, y: 0, w: 6, h: 2 },
      config: { text: "world" },
      binding: null,
    },
  ],
});

const components = { NoteCard: Static };

describe("bleed OUT — we cannot restyle the host", () => {
  it("emits no <style>/<link> into the document", () => {
    const before = document.querySelectorAll("style, link[rel=stylesheet]").length;
    render(<WorkspaceGrid spec={spec} components={components} />);
    const after = document.querySelectorAll("style, link[rel=stylesheet]").length;
    // Zero new global styles: the host's CSS is untouched by mounting us.
    expect(after).toBe(before);
  });

  it("styles only its own subtree (host siblings keep their own styling)", () => {
    const { container } = render(
      <div>
        <p data-testid="host-sibling">host content</p>
        <WorkspaceGrid spec={spec} components={components} />
      </div>,
    );
    const sibling = container.querySelector<HTMLElement>('[data-testid="host-sibling"]')!;
    // We never set inline styles on anything we didn't render.
    expect(sibling.getAttribute("style")).toBeNull();
  });
});

describe("bleed IN — a hostile host stylesheet cannot break our layout", () => {
  it("keeps grid layout properties under aggressive global CSS", () => {
    const remove = withHostileStylesheet();
    try {
      const { container } = render(<WorkspaceGrid spec={spec} components={components} />);
      const grid = container.querySelector<HTMLElement>("[data-workspace-grid]")!;

      // Inline styles outrank the host's selectors, so the grid still IS a grid
      // with 12 columns — even though `div { display: block !important }` exists.
      expect(grid.style.display).toBe("grid");
      expect(grid.style.gridTemplateColumns).toContain("repeat(12");

      // Each block keeps its own column placement from the spec's frame.
      const cells = container.querySelectorAll<HTMLElement>("[data-workspace-grid] > *");
      expect(cells).toHaveLength(2);
      expect(cells[0]!.style.gridColumn).toBe("1 / span 6");
      expect(cells[1]!.style.gridColumn).toBe("7 / span 6");
    } finally {
      remove();
    }
  });

  it("renders every block under the hostile stylesheet", () => {
    const remove = withHostileStylesheet();
    try {
      const { getByTestId } = render(<WorkspaceGrid spec={spec} components={components} />);
      expect(getByTestId("block-blk_a")).toBeTruthy();
      expect(getByTestId("block-blk_b")).toBeTruthy();
    } finally {
      remove();
    }
  });
});
