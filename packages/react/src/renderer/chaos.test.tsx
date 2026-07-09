import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  defineEntity,
  type EntityContract,
  type QuerySpec,
  type WorkspaceSpec,
} from "@workspace-engine/core";
import { WorkspaceGrid } from "./WorkspaceGrid";
import { WorkspaceQueryClientProvider } from "../query/client";
import type { BlockComponentProps, WorkspaceDataSource } from "./types";

/**
 * Hostile-conditions chaos suite (card #41). The vendor `fetch` is slow, flaky,
 * and occasionally garbage — this proves "never a white screen, never a silent
 * drop" is true rather than aspirational. We inject misbehaving fetch FUNCTIONS
 * directly (the vendor executor is a function per ADR-4), which tests the exact
 * seam more faithfully than MSW's HTTP interception would.
 */

afterEach(cleanup);

type FetchImpl = (args: { query: QuerySpec; auth: unknown }) => Promise<unknown[]>;

function contractFor(name: string, fetchImpl: FetchImpl, maxClientRows?: number): EntityContract {
  return defineEntity({
    name,
    schema: z.object({ id: z.string(), n: z.number(), name: z.string() }),
    capabilities: {
      filterable: ["n", "name"],
      sortable: ["n", "name"],
      ...(maxClientRows ? { maxClientRows } : {}),
    },
    fetch: fetchImpl,
  });
}

function List({ data }: BlockComponentProps) {
  const rows = (data as { id?: string }[] | undefined) ?? [];
  return (
    <div data-block="List" data-count={rows.length}>
      {rows.map((r, i) => (
        <span key={r.id ?? i} data-row-order={i} data-row-id={r.id}>
          {r.id}
        </span>
      ))}
    </div>
  );
}

const components = { List };

function noRetryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const emptyQuery: QuerySpec = { filters: [], sort: [] };

function boundBlock(id: string, entity: string, query: QuerySpec = emptyQuery, y = 0) {
  return { id, type: "List", frame: { x: 0, y, w: 6, h: 3 }, config: {}, binding: { entity, query } };
}

function specWith(blocks: unknown[]): WorkspaceSpec {
  // Constructed directly (not parseSpec) so the scale test can exceed the
  // 24-block spec cap — the renderer must handle whatever it's handed.
  return {
    specVersion: 1,
    title: "chaos",
    timezone: "UTC",
    refresh: { mode: "manual" },
    layout: { columns: 12 },
    blocks,
  } as WorkspaceSpec;
}

function renderGrid(
  blocks: unknown[],
  contracts: Record<string, EntityContract>,
  onBlockDegraded?: ReturnType<typeof vi.fn>,
) {
  const dataSource: WorkspaceDataSource = { contracts, auth: {} };
  return render(
    <WorkspaceQueryClientProvider client={noRetryClient()}>
      <WorkspaceGrid
        spec={specWith(blocks)}
        components={components}
        dataSource={dataSource}
        onBlockDegraded={onBlockDegraded}
      />
    </WorkspaceQueryClientProvider>,
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const cell = (container: HTMLElement, id: string) =>
  container.querySelector(`[data-block-id="${id}"]`)!;

describe("chaos: hostile vendor fetch", () => {
  it("a 500 / rejection degrades to a per-block broken state; siblings render", async () => {
    const good = contractFor("good", async () => [{ id: "g1", n: 1, name: "a" }]);
    const bad = contractFor("bad", async () => {
      throw new Error("500 upstream");
    });
    const onDeg = vi.fn();
    const { container } = renderGrid(
      [boundBlock("blk_good", "good"), boundBlock("blk_bad", "bad", emptyQuery, 3)],
      { good, bad },
      onDeg,
    );

    await waitFor(() =>
      expect(cell(container, "blk_good").querySelector('[data-row-id="g1"]')).not.toBeNull(),
    );
    await waitFor(() =>
      expect(cell(container, "blk_bad").querySelector("[data-workspace-broken-block]")).not.toBeNull(),
    );
    expect(onDeg).toHaveBeenCalledWith(expect.objectContaining({ blockId: "blk_bad", reason: "fetch-error" }));
  });

  it("a never-resolving (timeout) fetch stays a skeleton and never blocks siblings", async () => {
    const good = contractFor("good", async () => [{ id: "g1", n: 1, name: "a" }]);
    const slow = contractFor("slow", () => new Promise<unknown[]>(() => {}));
    const { container } = renderGrid(
      [boundBlock("blk_good", "good"), boundBlock("blk_slow", "slow", emptyQuery, 3)],
      { good, slow },
    );

    await waitFor(() =>
      expect(cell(container, "blk_good").querySelector('[data-row-id="g1"]')).not.toBeNull(),
    );
    // Slow one is still a skeleton — not broken, not crashed.
    expect(cell(container, "blk_slow").querySelector("[data-workspace-skeleton]")).not.toBeNull();
    expect(cell(container, "blk_slow").querySelector("[data-workspace-broken-block]")).toBeNull();
  });

  it("a non-array (garbage) response degrades with a clear message", async () => {
    const garbage = contractFor("garbage", async () => ({ error: "nope" } as unknown as unknown[]));
    const { container } = renderGrid([boundBlock("blk_g", "garbage")], { garbage });
    await waitFor(() =>
      expect(cell(container, "blk_g").querySelector("[data-workspace-broken-block]")).not.toBeNull(),
    );
    const detail = cell(container, "blk_g").querySelector("[data-broken-detail]")?.textContent;
    expect(detail).toMatch(/array of rows/);
  });

  it("malformed rows (nulls inside the array) degrade rather than crash", async () => {
    const bad = contractFor("bad", async () => [{ id: "ok", n: 1, name: "x" }, null, "nope"] as unknown[]);
    const { container } = renderGrid(
      [boundBlock("blk_m", "bad", { filters: [{ field: "n", op: "gte", value: 0 }], sort: [] })],
      { bad },
    );
    await waitFor(() =>
      expect(cell(container, "blk_m").querySelector("[data-workspace-broken-block]")).not.toBeNull(),
    );
  });

  it("null values in a sort field render in the correct order (review #68 guard)", async () => {
    const rows = [
      { id: "a", n: 5, name: "" },
      { id: "b", n: null, name: "" },
      { id: "c", n: 3, name: "" },
    ];
    const srt = contractFor("srt", async () => rows as unknown[]);
    const { container } = renderGrid(
      [boundBlock("blk_s", "srt", { filters: [], sort: [{ field: "n", dir: "asc" }] })],
      { srt },
    );
    await waitFor(() => expect(cell(container, "blk_s").querySelector('[data-block="List"]')).not.toBeNull());
    const ids = [...cell(container, "blk_s").querySelectorAll("[data-row-id]")].map((e) =>
      e.getAttribute("data-row-id"),
    );
    expect(ids).toEqual(["c", "a", "b"]); // valid values ordered, null last — not corrupted
  });
});

describe("chaos: scale + the client query engine", () => {
  it("a 100k-row response over the cap degrades with a cap error (guides to server mode)", async () => {
    const big = contractFor("big", async () =>
      Array.from({ length: 100_000 }, (_, i) => ({ id: String(i), n: i, name: "" })),
    );
    const onDeg = vi.fn();
    const { container } = renderGrid([boundBlock("blk_big", "big")], { big }, onDeg);
    await waitFor(() =>
      expect(cell(container, "blk_big").querySelector("[data-workspace-broken-block]")).not.toBeNull(),
    );
    expect(cell(container, "blk_big").querySelector("[data-broken-detail]")?.textContent).toMatch(/cap/);
    expect(onDeg).toHaveBeenCalledWith(expect.objectContaining({ blockId: "blk_big", reason: "fetch-error" }));
  });

  it("a 100k-row response with a raised cap runs through the engine within budget", async () => {
    const big = contractFor(
      "big2",
      async () => Array.from({ length: 100_000 }, (_, i) => ({ id: String(i), n: i, name: "" })),
      200_000,
    );
    const start = performance.now();
    const { container } = renderGrid(
      [boundBlock("blk_b2", "big2", { filters: [{ field: "n", op: "gte", value: 99_990 }], sort: [] })],
      { big2: big },
    );
    await waitFor(() => expect(cell(container, "blk_b2").querySelector('[data-block="List"]')).not.toBeNull());
    expect(cell(container, "blk_b2").querySelector('[data-block="List"]')?.getAttribute("data-count")).toBe("10");
    expect(performance.now() - start).toBeLessThan(3000);
  });

  it("a 50-block workspace mounts within budget and every block renders", async () => {
    const fast = contractFor("fast", async () => [{ id: "x", n: 1, name: "" }]);
    const blocks = Array.from({ length: 50 }, (_, i) => boundBlock(`blk_${i}`, "fast", emptyQuery, i));

    const start = performance.now();
    const { container } = renderGrid(blocks, { fast });
    expect(performance.now() - start).toBeLessThan(2000); // sync mount budget (jsdom)
    expect(container.querySelectorAll("[data-workspace-cell]")).toHaveLength(50);

    await waitFor(() => expect(container.querySelectorAll('[data-block="List"]')).toHaveLength(50));
  });

  it("a slow block never blocks healthy blocks (no request waterfall)", async () => {
    const slow = deferred<unknown[]>();
    const slowContract = contractFor("slow", () => slow.promise);
    const fast = contractFor("fast", async () => [{ id: "f", n: 1, name: "" }]);
    const { container } = renderGrid(
      [boundBlock("blk_fast", "fast"), boundBlock("blk_slow", "slow", emptyQuery, 3)],
      { fast, slow: slowContract },
    );

    // The fast block resolves and renders while the slow one is still pending —
    // proof the SDK fires block queries in parallel, no waterfall.
    await waitFor(() =>
      expect(cell(container, "blk_fast").querySelector('[data-row-id="f"]')).not.toBeNull(),
    );
    expect(cell(container, "blk_slow").querySelector("[data-workspace-skeleton]")).not.toBeNull();

    slow.resolve([{ id: "s", n: 1, name: "" }]);
    await waitFor(() =>
      expect(cell(container, "blk_slow").querySelector('[data-row-id="s"]')).not.toBeNull(),
    );
  });
});
