import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  defineEntity,
  parseSpec,
  type EntityContract,
  type ValidationContext,
  type WorkspaceSpec,
} from "@workspace-engine/core";
import { WorkspaceGrid } from "./WorkspaceGrid";
import { WorkspaceQueryClientProvider } from "../query/client";
import type { BlockComponentProps } from "./types";

afterEach(cleanup);

function caseContract(fetchImpl = vi.fn().mockResolvedValue([{ id: "c1" }])): EntityContract {
  return defineEntity({
    name: "case",
    schema: z.object({ id: z.string(), status: z.enum(["open", "closed"]), due: z.string() }),
    fieldKinds: { due: "date" },
    capabilities: { filterable: ["status", "due"], sortable: ["due"], defaultLimit: 50, maxLimit: 100 },
    fetch: fetchImpl,
  });
}

function Table({ data }: BlockComponentProps) {
  const rows = (data as unknown[] | undefined) ?? [];
  return <div data-testid="rows">{rows.length}</div>;
}

function Note() {
  return <div data-testid="note">note</div>;
}

const components = { CasesTable: Table, Note };

function noRetryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderGrid(
  spec: WorkspaceSpec,
  opts: {
    contracts?: Record<string, EntityContract>;
    validation?: ValidationContext;
    onBlockDegraded?: ReturnType<typeof vi.fn>;
    comps?: Record<string, (p: BlockComponentProps) => ReactElement>;
  } = {},
) {
  return render(
    <WorkspaceQueryClientProvider client={noRetryClient()}>
      <WorkspaceGrid
        spec={spec}
        components={opts.comps ?? components}
        dataSource={opts.contracts ? { contracts: opts.contracts, auth: {} } : undefined}
        validation={opts.validation}
        onBlockDegraded={opts.onBlockDegraded}
      />
    </WorkspaceQueryClientProvider>,
  );
}

/** A bound block referencing `sla_deadline`, which the contract does not expose. */
function driftSpec(): WorkspaceSpec {
  return parseSpec({
    specVersion: 1,
    title: "Ops",
    timezone: "UTC",
    blocks: [
      {
        id: "blk_a1",
        type: "CasesTable",
        frame: { x: 0, y: 0, w: 6, h: 4 },
        binding: { entity: "case", query: { filters: [{ field: "sla_deadline", op: "eq", value: "x" }] } },
      },
      { id: "blk_c3", type: "Note", frame: { x: 6, y: 0, w: 6, h: 2 }, binding: null },
    ],
  });
}

describe("graceful degradation", () => {
  it("contract drift: broken block names the missing field, sibling renders, telemetry fires", async () => {
    const fetchImpl = vi.fn().mockResolvedValue([]);
    const onBlockDegraded = vi.fn();
    const { container, getByTestId } = renderGrid(driftSpec(), {
      contracts: { case: caseContract(fetchImpl) },
      validation: { contracts: { case: caseContract(fetchImpl) } },
      onBlockDegraded,
    });

    const broken = container.querySelector('[data-block-id="blk_a1"] [data-workspace-broken-block]');
    expect(broken).not.toBeNull();
    expect(broken?.textContent).toContain("sla_deadline"); // explicit reason
    expect(getByTestId("note")).not.toBeNull(); // healthy sibling unaffected
    expect(fetchImpl).not.toHaveBeenCalled(); // drift caught before fetch

    await waitFor(() =>
      expect(onBlockDegraded).toHaveBeenCalledWith(
        expect.objectContaining({ blockId: "blk_a1", reason: "contract-drift" }),
      ),
    );
  });

  it("fires unknown-type telemetry for an unregistered block type", async () => {
    const spec = parseSpec({
      specVersion: 1,
      title: "t",
      blocks: [{ id: "blk_x", type: "Mystery", frame: { x: 0, y: 0, w: 6, h: 4 }, binding: null }],
    });
    const onBlockDegraded = vi.fn();
    renderGrid(spec, { onBlockDegraded });
    await waitFor(() =>
      expect(onBlockDegraded).toHaveBeenCalledWith(
        expect.objectContaining({ blockId: "blk_x", reason: "unknown-type" }),
      ),
    );
  });

  it("fires missing-contract telemetry when a bound entity has no contract", async () => {
    const spec = parseSpec({
      specVersion: 1,
      title: "t",
      blocks: [
        {
          id: "blk_a1",
          type: "CasesTable",
          frame: { x: 0, y: 0, w: 6, h: 4 },
          binding: { entity: "case", query: { filters: [] } },
        },
      ],
    });
    const onBlockDegraded = vi.fn();
    // Data source with an empty contracts map, no validation context.
    renderGrid(spec, { contracts: {}, onBlockDegraded });
    await waitFor(() =>
      expect(onBlockDegraded).toHaveBeenCalledWith(
        expect.objectContaining({ blockId: "blk_a1", reason: "missing-contract" }),
      ),
    );
  });

  it("fires fetch-error telemetry when the vendor fetch fails", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("502"));
    const spec = parseSpec({
      specVersion: 1,
      title: "t",
      timezone: "UTC",
      blocks: [
        {
          id: "blk_a1",
          type: "CasesTable",
          frame: { x: 0, y: 0, w: 6, h: 4 },
          binding: { entity: "case", query: { filters: [] } },
        },
      ],
    });
    const onBlockDegraded = vi.fn();
    renderGrid(spec, { contracts: { case: caseContract(fetchImpl) }, onBlockDegraded });
    await waitFor(() =>
      expect(onBlockDegraded).toHaveBeenCalledWith(
        expect.objectContaining({ blockId: "blk_a1", reason: "fetch-error" }),
      ),
    );
  });

  it("does NOT retroactively enforce a tightened block cap on a saved spec (review #67)", async () => {
    // Two valid static blocks, but a policy that now allows only one.
    const spec = parseSpec({
      specVersion: 1,
      title: "t",
      blocks: [
        { id: "blk_1", type: "Note", frame: { x: 0, y: 0, w: 6, h: 2 }, binding: null },
        { id: "blk_2", type: "Note", frame: { x: 6, y: 0, w: 6, h: 2 }, binding: null },
      ],
    });
    const onBlockDegraded = vi.fn();
    // validateSpec REJECTs with a (non-block-scoped) BlockCountError, which we
    // intentionally drop: the board renders as authored, nothing degrades.
    const { container } = renderGrid(spec, {
      validation: { contracts: {}, policy: { maxBlocks: 1 } },
      comps: { Note },
      onBlockDegraded,
    });

    expect(container.querySelectorAll('[data-testid="note"]')).toHaveLength(2);
    expect(container.querySelector("[data-workspace-broken-block]")).toBeNull();
    await waitFor(() => expect(onBlockDegraded).not.toHaveBeenCalled());
  });

  it("fires render-error telemetry when a block component throws", async () => {
    const spec = parseSpec({
      specVersion: 1,
      title: "t",
      blocks: [{ id: "blk_boom", type: "Note", frame: { x: 0, y: 0, w: 6, h: 4 }, binding: null }],
    });
    const Boom = (): ReactElement => {
      throw new Error("kaboom");
    };
    const onBlockDegraded = vi.fn();
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    renderGrid(spec, { comps: { Note: Boom }, onBlockDegraded });
    await waitFor(() =>
      expect(onBlockDegraded).toHaveBeenCalledWith(
        expect.objectContaining({ blockId: "blk_boom", reason: "render-error" }),
      ),
    );
    spy.mockRestore();
  });
});
