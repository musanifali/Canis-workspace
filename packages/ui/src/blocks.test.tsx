import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { WorkspaceFilterProvider, useRuntimeFilters, type BlockComponentProps } from "@workspace-engine/react";
import type { Block } from "@workspace-engine/core";
import { Board, Graph, KpiCards, Queue, Table } from "./blocks/data-blocks";
import { FilterBar } from "./blocks/filter-bar";
import { defaultBlocks } from "./blocks";

afterEach(cleanup);

function mkBlock(type: string, config: Record<string, unknown>): Block {
  return { id: `blk_${type}`, type, frame: { x: 0, y: 0, w: 6, h: 4 }, config, binding: null } as unknown as Block;
}

function props(block: Block, data: unknown): BlockComponentProps {
  return { block, status: "success", data, error: null, isFetching: false, dataUpdatedAt: Date.now(), refetch: () => {} };
}

const ROWS = [
  { id: "r1", risk: "high", score: 90 },
  { id: "r2", risk: "low", score: 20 },
];

describe("default blocks render generically", () => {
  it("Table renders a native table with columns from config", () => {
    const { container } = render(
      <Table {...props(mkBlock("CasesTable", { title: "Cases", columns: ["id", "risk"] }), ROWS)} />,
    );
    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    expect(container.querySelectorAll("th[scope=col]")).toHaveLength(2);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(container.textContent).toContain("Cases");
    expect(container.textContent).toContain("high");
  });

  it("Table infers columns from the data when none configured, and shows an empty message", () => {
    const inferred = render(<Table {...props(mkBlock("CasesTable", {}), ROWS)} />);
    expect(inferred.container.querySelectorAll("th[scope=col]")).toHaveLength(3); // id, risk, score
    const empty = render(<Table {...props(mkBlock("CasesTable", { emptyMessage: "Nothing here" }), [])} />);
    expect(empty.container.textContent).toContain("Nothing here");
  });

  it("KpiCards reads aggregate aliases", () => {
    const { container } = render(
      <KpiCards
        {...props(mkBlock("KpiCards", { cards: [{ alias: "total", label: "Total" }, { alias: "avg", label: "Average" }] }), [
          { total: 42, avg: 7.5 },
        ])}
      />,
    );
    expect(container.textContent).toContain("Total");
    expect(container.textContent).toContain("42");
    expect(container.textContent).toContain("7.5");
  });

  it("Queue lists rows, Board renders groups, Graph draws labeled bars", () => {
    const queue = render(<Queue {...props(mkBlock("CaseQueue", { title: "Q" }), ROWS)} />);
    expect(queue.container.querySelectorAll("ul > li")).toHaveLength(2);

    const board = render(
      <Board {...props(mkBlock("GroupedBoard", {}), [{ group: "high", rows: [ROWS[0]] }, { group: "low", rows: [ROWS[1]] }])} />,
    );
    expect(board.container.textContent).toContain("high");
    expect(board.container.textContent).toContain("low");

    const graph = render(<Graph {...props(mkBlock("Graph", { kind: "bar" }), [{ a: 10, b: 5 }])} />);
    const chart = graph.container.querySelector('[role="img"]');
    expect(chart?.getAttribute("aria-label")).toContain("a 10");
    expect(graph.container.querySelectorAll("[data-bar]")).toHaveLength(2);
  });
});

describe("accessibility: native controls, no clickable divs", () => {
  it("FilterBar uses a native form, labeled inputs, and a button", () => {
    const { container, getByLabelText } = render(
      <WorkspaceFilterProvider>
        <FilterBar {...props(mkBlock("FilterBar", { targets: ["blk_t"], fields: ["name"] }), undefined)} />
      </WorkspaceFilterProvider>,
    );
    expect(container.querySelector('form[role="search"]')).not.toBeNull();
    expect(getByLabelText("Filter by name").tagName).toBe("INPUT");
    expect(container.querySelector("button")?.textContent).toBe("Clear");
    // No clickable divs anywhere in the default set.
    expect(container.querySelectorAll("div[onclick]")).toHaveLength(0);
  });
});

describe("theming via --we-* custom properties", () => {
  it("blocks style themselves through CSS variables", () => {
    const { container } = render(<Table {...props(mkBlock("CasesTable", { title: "T" }), ROWS)} />);
    const styled = container.querySelector('[data-testid="ui-table"]');
    expect(styled?.getAttribute("style")).toContain("--we-");
  });
});

describe("FilterBar drives the runtime filter bus", () => {
  function Probe({ id }: { id: string }) {
    const filters = useRuntimeFilters(id);
    return <span data-testid="probe">{JSON.stringify(filters)}</span>;
  }

  it("typing a value pushes a contains filter onto every target block", async () => {
    const { getByLabelText, getByTestId } = render(
      <WorkspaceFilterProvider>
        <FilterBar {...props(mkBlock("FilterBar", { targets: ["blk_t"], fields: ["name"] }), undefined)} />
        <Probe id="blk_t" />
      </WorkspaceFilterProvider>,
    );
    expect(getByTestId("probe").textContent).toBe("[]");

    fireEvent.change(getByLabelText("Filter by name"), { target: { value: "acme" } });
    await waitFor(() => expect(getByTestId("probe").textContent).toContain("acme"));
    expect(getByTestId("probe").textContent).toContain('"op":"contains"');
    expect(getByTestId("probe").textContent).toContain('"field":"name"');
  });
});

describe("defaultBlocks", () => {
  it("registers all six block types", () => {
    expect(defaultBlocks.map((b) => b.type).sort()).toEqual(
      ["CaseQueue", "CasesTable", "FilterBar", "Graph", "GroupedBoard", "KpiCards"],
    );
  });
});
