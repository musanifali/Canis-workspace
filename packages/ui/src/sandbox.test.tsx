import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { WorkspaceSandbox } from "./sandbox";
import { SAMPLE_ROWS } from "./sample";

afterEach(cleanup);

describe("WorkspaceSandbox — devMode, zero config", () => {
  it("renders a live sample workspace with no props (no contracts, no blocks, no network)", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    const { container, getByTestId } = render(<WorkspaceSandbox />);

    await waitFor(() => {
      expect(container.querySelector("[data-workspace-skeleton]")).toBeNull();
      expect(container.querySelector("[data-workspace-broken-block]")).toBeNull();
    });

    // The default block set rendered against the bundled sample.
    expect(getByTestId("ui-kpis")).toBeTruthy();
    expect(getByTestId("ui-table")).toBeTruthy();
    expect(getByTestId("ui-board")).toBeTruthy();
    // KPI count reflects the seeded row count (24) — proves the bundled data, no network.
    expect(getByTestId("ui-kpis").textContent).toContain(String(SAMPLE_ROWS.length));

    info.mockRestore();
  });
});
