import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { parseSpec, type WorkspaceSpec } from "@workspace-engine/core";
import { WorkspaceRenderer } from "./WorkspaceRenderer";
import type { BlockComponentProps, BlockComponentRegistry } from "./types";

afterEach(cleanup);

/** A hand-written spec — the exact path a vendor takes before any LLM exists. */
function makeSpec(overrides: Partial<WorkspaceSpec> = {}): WorkspaceSpec {
  return parseSpec({
    specVersion: 1,
    title: "Ops overview",
    blocks: [
      {
        id: "blk_a1",
        type: "KpiCards",
        frame: { x: 0, y: 0, w: 12, h: 2 },
        config: { cards: [{ alias: "total", label: "Total" }] },
        binding: null,
      },
      {
        id: "blk_b2",
        type: "CasesTable",
        frame: { x: 0, y: 2, w: 8, h: 6 },
        config: { title: "Cases" },
        binding: null,
      },
    ],
    ...overrides,
  });
}

function Kpi({ block }: BlockComponentProps) {
  const cards = (block.config.cards ?? []) as { label: string }[];
  return <div data-testid="kpi">{cards.map((c) => c.label).join(",")}</div>;
}

function Table({ block }: BlockComponentProps) {
  return <div data-testid="table">{String(block.config.title ?? "")}</div>;
}

const components: BlockComponentRegistry = { KpiCards: Kpi, CasesTable: Table };

describe("WorkspaceRenderer", () => {
  it("renders a hand-written spec's blocks through the registry", () => {
    const { container, getByTestId } = render(
      <WorkspaceRenderer spec={makeSpec()} components={components} />,
    );

    expect(getByTestId("kpi").textContent).toBe("Total");
    expect(getByTestId("table").textContent).toBe("Cases");
    expect(container.querySelectorAll("[data-workspace-cell]")).toHaveLength(2);
  });

  it("positions each block on the 12-col grid from its frame (1-indexed lines)", () => {
    const { container } = render(
      <WorkspaceRenderer spec={makeSpec()} components={components} />,
    );

    const kpiCell = container.querySelector<HTMLElement>(
      '[data-block-id="blk_a1"]',
    );
    const tableCell = container.querySelector<HTMLElement>(
      '[data-block-id="blk_b2"]',
    );

    // frame {x:0,y:0,w:12,h:2} → columns 1/span 12, rows 1/span 2
    expect(kpiCell?.style.gridColumn).toBe("1 / span 12");
    expect(kpiCell?.style.gridRow).toBe("1 / span 2");
    // frame {x:0,y:2,w:8,h:6} → columns 1/span 8, rows 3/span 6
    expect(tableCell?.style.gridColumn).toBe("1 / span 8");
    expect(tableCell?.style.gridRow).toBe("3 / span 6");
  });

  it("renders a broken-block state for an unregistered type instead of crashing", () => {
    const { container } = render(
      <WorkspaceRenderer spec={makeSpec()} components={{ KpiCards: Kpi }} />,
    );

    const broken = container.querySelector("[data-workspace-broken-block]");
    expect(broken).not.toBeNull();
    expect(broken?.getAttribute("data-block-type")).toBe("CasesTable");
    expect(broken?.getAttribute("role")).toBe("alert");
    // the healthy sibling still rendered
    expect(container.querySelector('[data-testid="kpi"]')).not.toBeNull();
  });

  it("isolates a throwing block to a broken state and keeps siblings alive", () => {
    function Boom(): never {
      throw new Error("kaboom");
    }
    // React logs the caught error to console.error; silence it for a clean run.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const onBlockError = vi.fn();

    const { container, getByTestId } = render(
      <WorkspaceRenderer
        spec={makeSpec()}
        components={{ KpiCards: Kpi, CasesTable: Boom }}
        onBlockError={onBlockError}
      />,
    );

    const broken = container.querySelector("[data-workspace-broken-block]");
    expect(broken?.getAttribute("data-block-type")).toBe("CasesTable");
    expect(broken?.querySelector("[data-broken-detail]")?.textContent).toBe(
      "kaboom",
    );
    expect(onBlockError).toHaveBeenCalledOnce();
    expect(getByTestId("kpi")).not.toBeNull();

    spy.mockRestore();
  });
});
