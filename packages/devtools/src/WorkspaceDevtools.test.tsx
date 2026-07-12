import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { WorkspaceDevtools } from "./WorkspaceDevtools";
import { clearDevtoolsLog, recordQuery, recordSpec, recordVerdict } from "./bus";

afterEach(() => {
  cleanup();
  clearDevtoolsLog();
});

describe("WorkspaceDevtools (card #44)", () => {
  it("opens to the spec tab and shows the current spec + verdict + query", () => {
    recordSpec({ specVersion: 1, title: "Cases", blocks: [{ id: "blk_a" }] }, "Cases", 1);
    recordVerdict("reject", "unknown field", [
      { path: "blocks.0.binding", message: 'unknown field "lawyer"', fix: "allowed: analyst", code: "ContractViolationError" },
    ]);
    recordQuery({ blockId: "blk_a", entity: "case", query: { groupBy: "analyst" }, status: "success", rows: 42, ms: 7 });

    render(<WorkspaceDevtools defaultOpen />);
    // Spec tab (default): the JSON + title.
    expect(screen.getByTestId("devtools-spec").textContent).toMatch(/"title": "Cases"/);

    // Verdicts tab: per-field reason + fix.
    fireEvent.click(screen.getByTestId("devtools-tab-verdicts"));
    const verdicts = screen.getByTestId("devtools-verdicts").textContent!;
    expect(verdicts).toMatch(/REJECT/);
    expect(verdicts).toMatch(/unknown field "lawyer"/);
    expect(verdicts).toMatch(/allowed: analyst/);

    // Queries tab: timeline entry with rows + ms.
    fireEvent.click(screen.getByTestId("devtools-tab-queries"));
    const queries = screen.getByTestId("devtools-queries").textContent!;
    expect(queries).toMatch(/blk_a/);
    expect(queries).toMatch(/42 rows/);
    expect(queries).toMatch(/7ms/);
    expect(queries).toMatch(/groupBy analyst/);
  });

  it("keeps a spec history when several are generated", () => {
    recordSpec({ title: "A" }, "A", 1);
    recordSpec({ title: "B" }, "B", 2);
    render(<WorkspaceDevtools defaultOpen />);
    const spec = screen.getByTestId("devtools-spec").textContent!;
    expect(spec).toMatch(/History \(2\)/);
    expect(spec).toMatch(/"title": "B"/); // newest is current
  });

  it("collapses to a toggle showing the event count", () => {
    recordSpec({ title: "A" }, "A", 1);
    render(<WorkspaceDevtools />);
    expect(screen.getByTestId("devtools-toggle").textContent).toMatch(/\(1\)/);
    expect(screen.queryByTestId("devtools-panel")).toBeNull();
    fireEvent.click(screen.getByTestId("devtools-toggle"));
    expect(screen.getByTestId("devtools-panel")).toBeTruthy();
  });
});
