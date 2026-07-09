import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { z } from "zod";
import { defineEntity, parseSpec, type EntityContract, type WorkspaceSpec } from "@workspace-engine/core";
import { WorkspaceProvider } from "./WorkspaceProvider";
import { defineBlock, buildBlockRegistry, BlockRegistrationError } from "./defineBlock";
import { WorkspaceRenderer } from "../renderer/WorkspaceRenderer";
import type { BlockComponentProps } from "../renderer/types";

afterEach(cleanup);

function caseContract(fetchImpl = vi.fn().mockResolvedValue([{ id: "c1" }, { id: "c2" }])): EntityContract {
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

const tableBlock = defineBlock({ type: "CasesTable", accepts: { shape: "rows" }, component: Table });

function boundSpec(): WorkspaceSpec {
  return parseSpec({
    specVersion: 1,
    title: "Cases",
    timezone: "UTC",
    blocks: [
      {
        id: "blk_a1",
        type: "CasesTable",
        frame: { x: 0, y: 0, w: 8, h: 6 },
        config: { title: "Cases" },
        binding: { entity: "case", query: { filters: [] } },
      },
    ],
  });
}

describe("defineBlock / buildBlockRegistry (registration validation)", () => {
  it("builds a type→component registry for valid definitions", () => {
    const registry = buildBlockRegistry([tableBlock], { contracts: { case: caseContract() } });
    expect(registry.CasesTable).toBe(Table);
  });

  it("rejects an unknown block type", () => {
    const bad = defineBlock({ type: "Nope", accepts: { shape: "rows" }, component: Table });
    expect(() => buildBlockRegistry([bad], { contracts: {} })).toThrow(BlockRegistrationError);
  });

  it("rejects an accepts.shape that disagrees with the registry binding shape", () => {
    // CasesTable's registry binding shape is "rows", not "aggregate".
    const bad = defineBlock({ type: "CasesTable", accepts: { shape: "aggregate" }, component: Table });
    expect(() => buildBlockRegistry([bad], { contracts: {} })).toThrow(/does not match the registry binding shape/);
  });

  it("rejects accepts.entities that reference an unsupplied contract", () => {
    const withEntity = defineBlock({ type: "CasesTable", accepts: { shape: "rows", entities: ["ghost"] }, component: Table });
    expect(() => buildBlockRegistry([withEntity], { contracts: { case: caseContract() } })).toThrow(/ghost/);
  });

  it("rejects duplicate block types", () => {
    expect(() => buildBlockRegistry([tableBlock, tableBlock], { contracts: { case: caseContract() } })).toThrow(/duplicate/);
  });

  it("rejects a structurally invalid shape at defineBlock time", () => {
    expect(() =>
      // @ts-expect-error invalid shape on purpose
      defineBlock({ type: "CasesTable", accepts: { shape: "table" }, component: Table }),
    ).toThrow(BlockRegistrationError);
  });
});

describe("WorkspaceProvider", () => {
  it("wires contracts + blocks so <WorkspaceRenderer spec/> renders with no per-render props", async () => {
    const fetchImpl = vi.fn().mockResolvedValue([{ id: "c1" }, { id: "c2" }]);
    const { getByTestId } = render(
      <WorkspaceProvider apiKey="pk_test" userToken={{ token: "u1" }} contracts={[caseContract(fetchImpl)]} blocks={[tableBlock]}>
        <WorkspaceRenderer spec={boundSpec()} />
      </WorkspaceProvider>,
    );

    await waitFor(() => expect(getByTestId("rows").textContent).toBe("2"));
    // userToken flowed through to the vendor fetch as auth.
    expect(fetchImpl.mock.calls[0]![0]).toMatchObject({ auth: { token: "u1" } });
  });

  it("throws BlockRegistrationError at mount for a misconfigured block", () => {
    const bad = defineBlock({ type: "CasesTable", accepts: { shape: "groups" }, component: Table });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      render(
        <WorkspaceProvider apiKey="pk" userToken={null} contracts={[caseContract()]} blocks={[bad]}>
          <div />
        </WorkspaceProvider>,
      ),
    ).toThrow(BlockRegistrationError);
    spy.mockRestore();
  });
});

describe("typed error taxonomy", () => {
  it("exports the SDK + core error classes from the package entry", async () => {
    const mod = await import("../index");
    for (const name of [
      "BindingFetchError",
      "BlockRegistrationError",
      "WorkspaceNotFoundError",
      "WorkspaceEditorSaveError",
      "ContractDefinitionError",
      "QueryPolicyError",
      "SpecParseError",
      "SpecMigrationError",
    ]) {
      expect(typeof (mod as Record<string, unknown>)[name]).toBe("function");
    }
  });
});
