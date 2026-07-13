import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";

// Mutable Tambo state the mocked hooks read; tests reassign between renders to
// simulate context updates (an empty thread, then the input value catching up).
let tamboState: { messages: unknown[]; isStreaming: boolean };
let inputState: { value: string; setValue: (v: string) => void; submit: () => Promise<unknown> };

vi.mock("@tambo-ai/react", () => ({
  useTambo: () => tamboState,
  useTamboThreadInput: () => inputState,
}));

import { ColdStartSuggestions } from "./cold-start-suggestions";
import { caseContract } from "@/workspace-engine/case-contract";
import { resetSuggestionStats, suggestionStats } from "@/workspace-engine/suggestion-analytics";

const contracts = [caseContract];
const curated = { analyst: [{ label: "My queue", prompt: "High-risk cases due this week" }] };

beforeEach(() => {
  resetSuggestionStats();
  tamboState = { messages: [], isStreaming: false };
  inputState = {
    value: "",
    setValue: vi.fn((v: string) => {
      inputState.value = v;
    }),
    submit: vi.fn(() => Promise.resolve()),
  };
});
afterEach(cleanup);

describe("ColdStartSuggestions (card #46)", () => {
  it("renders curated-then-derived chips on an empty thread", () => {
    const { getByText, container } = render(
      <ColdStartSuggestions contracts={contracts} role="analyst" curated={curated} />,
    );
    expect(getByText("My queue")).toBeTruthy(); // curated leads
    expect(container.querySelectorAll("button").length).toBeGreaterThan(1); // + derived
  });

  it("records an impression for every chip shown", () => {
    render(<ColdStartSuggestions contracts={contracts} role="analyst" curated={curated} max={5} />);
    const stats = suggestionStats();
    expect(stats).toHaveLength(5);
    expect(stats.every((s) => s.impressions === 1)).toBe(true);
  });

  it("hides once the thread has a message", () => {
    tamboState = { messages: [{ id: "m1" }], isStreaming: false };
    const { container } = render(
      <ColdStartSuggestions contracts={contracts} role="analyst" curated={curated} />,
    );
    expect(container.querySelector("button")).toBeNull();
  });

  it("on click: tracks the click and sends the chip's prompt", () => {
    const { getByText, rerender } = render(
      <ColdStartSuggestions contracts={contracts} role="analyst" curated={curated} />,
    );

    fireEvent.click(getByText("My queue"));

    // Click tracked (impression + click on the curated chip) and value staged.
    const stat = suggestionStats().find((s) => s.clicks > 0)!;
    expect(stat.clicks).toBe(1);
    expect(inputState.setValue).toHaveBeenCalledWith("High-risk cases due this week");
    expect(inputState.value).toBe("High-risk cases due this week");

    // Context value has now caught up → the submit effect fires the message.
    rerender(<ColdStartSuggestions contracts={contracts} role="analyst" curated={curated} />);
    expect(inputState.submit).toHaveBeenCalledTimes(1);
  });
});
