import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { SpecValidationError } from "@workspace-engine/core";
import { ClarifyNotice, RejectNotice } from "./notices";

afterEach(cleanup);

const contractError: SpecValidationError = {
  code: "ContractViolationError",
  blockId: "blk_a",
  entity: "case",
  violation: "unknown_field",
  field: "lawyer",
  allowed: ["risk", "analyst", "status"],
  message: 'block "blk_a": unknown field "lawyer"',
  fix: "allowed: risk, analyst, status",
};

describe("RejectNotice (card #23)", () => {
  it("shows the explanation and the supported alternatives from the errors", () => {
    const { getByTestId, getByText } = render(
      <RejectNotice explanation="I can't build that — no lawyer field." errors={[contractError]} />,
    );
    expect(getByTestId("reject-notice").textContent).toMatch(/no lawyer field/);
    // The alternatives the validator named appear as chips.
    for (const a of ["risk", "analyst", "status"]) expect(getByText(a)).toBeTruthy();
  });

  it("offers a refine affordance when wired", () => {
    const onRefine = vi.fn();
    const { getByText } = render(
      <RejectNotice explanation="x" errors={[]} onRefine={onRefine} />,
    );
    fireEvent.click(getByText(/Try a supported version/));
    expect(onRefine).toHaveBeenCalled();
  });
});

describe("ClarifyNotice (card #23)", () => {
  it("asks the one question and renders pickable options", () => {
    const onPick = vi.fn();
    const { getByTestId, getByText } = render(
      <ClarifyNotice question="Which entity should this show?" options={["case", "task"]} onPick={onPick} />,
    );
    expect(getByTestId("clarify-notice").textContent).toMatch(/Which entity/);
    fireEvent.click(getByText("case"));
    expect(onPick).toHaveBeenCalledWith("case");
  });

  it("renders options as static chips when no onPick is wired", () => {
    const { getByTestId } = render(
      <ClarifyNotice question="q" options={["a", "b"]} />,
    );
    // No buttons — just chips (answer in chat).
    expect(getByTestId("clarify-options").querySelectorAll("button").length).toBe(0);
  });
});
