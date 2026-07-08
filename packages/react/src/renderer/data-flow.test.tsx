import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  defineEntity,
  parseSpec,
  type WorkspaceSpec,
} from "@workspace-engine/core";
import { WorkspaceGrid } from "./WorkspaceGrid";
import { WorkspaceRenderer } from "./WorkspaceRenderer";
import { WorkspaceQueryClientProvider } from "../query/client";
import type { BlockComponentProps, WorkspaceDataSource } from "./types";

afterEach(cleanup);

const ROWS = [
  { id: "c1", status: "open", due: "2026-07-10" },
  { id: "c2", status: "open", due: "2026-07-20" },
];

function makeContract(fetchImpl: (args: { query: unknown; auth: unknown }) => Promise<unknown[]>) {
  return defineEntity({
    name: "case",
    schema: z.object({
      id: z.string(),
      status: z.enum(["open", "closed"]),
      due: z.string(),
    }),
    fieldKinds: { due: "date" },
    capabilities: {
      filterable: ["status", "due"],
      sortable: ["due"],
      defaultLimit: 50,
      maxLimit: 100,
    },
    fetch: fetchImpl,
  });
}

function makeSpec(refresh?: WorkspaceSpec["refresh"]): WorkspaceSpec {
  return parseSpec({
    specVersion: 1,
    title: "Cases",
    timezone: "UTC",
    ...(refresh ? { refresh } : {}),
    blocks: [
      {
        id: "blk_a1",
        type: "CasesTable",
        frame: { x: 0, y: 0, w: 8, h: 6 },
        config: { title: "Cases" },
        binding: {
          entity: "case",
          query: { filters: [{ field: "due", op: "between", value: { rel: "this_month" } }] },
        },
      },
    ],
  });
}

function Rows({ data, refetch, isFetching }: BlockComponentProps) {
  const rows = (data as unknown[] | undefined) ?? [];
  return (
    <div>
      <span data-testid="rows">{rows.length}</span>
      <span data-testid="fetching">{String(isFetching)}</span>
      <button data-testid="refetch" onClick={refetch}>
        refetch
      </button>
    </div>
  );
}

const components = { CasesTable: Rows };

function noRetryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe("query executor + data flow", () => {
  it("shows a shaped skeleton first, then renders fetched rows", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ROWS);
    const dataSource: WorkspaceDataSource = { contracts: { case: makeContract(fetchImpl) }, auth: { token: "u1" } };

    const { container, getByTestId } = render(
      <WorkspaceQueryClientProvider client={noRetryClient()}>
        <WorkspaceGrid spec={makeSpec()} components={components} dataSource={dataSource} />
      </WorkspaceQueryClientProvider>,
    );

    // Loading placeholder is a shaped skeleton, not a spinner.
    expect(container.querySelector("[data-workspace-skeleton]")).not.toBeNull();

    await waitFor(() => expect(getByTestId("rows").textContent).toBe("2"));
  });

  it("passes end-user auth through and resolves this_month at query time", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ROWS);
    const dataSource: WorkspaceDataSource = { contracts: { case: makeContract(fetchImpl) }, auth: { token: "u1" } };

    const { getByTestId } = render(
      <WorkspaceQueryClientProvider client={noRetryClient()}>
        <WorkspaceGrid spec={makeSpec()} components={components} dataSource={dataSource} />
      </WorkspaceQueryClientProvider>,
    );
    await waitFor(() => expect(getByTestId("rows").textContent).toBe("2"));

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const arg = fetchImpl.mock.calls[0]![0] as { query: { filters: unknown[]; limit: number }; auth: unknown };
    // Symbolic {rel:"this_month"} became absolute dates at execution.
    expect(arg.query.filters[0]).toMatchObject({
      field: "due",
      op: "between",
      value: [{ abs: expect.stringMatching(/^\d{4}-\d{2}-01$/) }, { abs: expect.any(String) }],
    });
    // Auth passed through unchanged; contract default limit applied by the executor.
    expect(arg.auth).toEqual({ token: "u1" });
    expect(arg.query.limit).toBe(50);
  });

  it("surfaces a BindingFetchError as a per-block broken state", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("502 upstream"));
    const dataSource: WorkspaceDataSource = { contracts: { case: makeContract(fetchImpl) }, auth: {} };

    const { container } = render(
      <WorkspaceQueryClientProvider client={noRetryClient()}>
        <WorkspaceGrid spec={makeSpec()} components={components} dataSource={dataSource} />
      </WorkspaceQueryClientProvider>,
    );

    await waitFor(() => {
      const broken = container.querySelector("[data-workspace-broken-block]");
      expect(broken).not.toBeNull();
    });
    const broken = container.querySelector("[data-workspace-broken-block]");
    expect(broken?.getAttribute("data-block-type")).toBe("CasesTable");
    expect(broken?.querySelector("[data-broken-detail]")?.textContent).toContain("502 upstream");
  });

  it("broken-blocks a bound entity with no registered contract", async () => {
    const dataSource: WorkspaceDataSource = { contracts: {}, auth: {} };
    const { container } = render(
      <WorkspaceQueryClientProvider client={noRetryClient()}>
        <WorkspaceGrid spec={makeSpec()} components={components} dataSource={dataSource} />
      </WorkspaceQueryClientProvider>,
    );
    const broken = container.querySelector("[data-workspace-broken-block]");
    expect(broken?.querySelector("[data-broken-reason]")?.textContent).toContain("case");
  });

  it("WorkspaceRenderer auto-mounts the internal query provider (no manual wiring)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ROWS);
    const dataSource: WorkspaceDataSource = { contracts: { case: makeContract(fetchImpl) }, auth: {} };
    const { getByTestId } = render(
      <WorkspaceRenderer spec={makeSpec()} components={components} dataSource={dataSource} />,
    );
    await waitFor(() => expect(getByTestId("rows").textContent).toBe("2"));
  });

  it("manual refresh never auto-refetches but honors an explicit refetch()", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ROWS);
    const dataSource: WorkspaceDataSource = { contracts: { case: makeContract(fetchImpl) }, auth: {} };
    const { getByTestId } = render(
      <WorkspaceQueryClientProvider client={noRetryClient()}>
        <WorkspaceGrid spec={makeSpec({ mode: "manual" })} components={components} dataSource={dataSource} />
      </WorkspaceQueryClientProvider>,
    );
    await waitFor(() => expect(getByTestId("rows").textContent).toBe("2"));
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    fireEvent.click(getByTestId("refetch"));
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));
  });

  it("interval refresh refetches on the configured interval", async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn().mockResolvedValue(ROWS);
      const dataSource: WorkspaceDataSource = { contracts: { case: makeContract(fetchImpl) }, auth: {} };
      render(
        <WorkspaceQueryClientProvider client={noRetryClient()}>
          <WorkspaceGrid
            spec={makeSpec({ mode: "interval", seconds: 60 })}
            components={components}
            dataSource={dataSource}
          />
        </WorkspaceQueryClientProvider>,
      );

      await vi.advanceTimersByTimeAsync(10);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
