import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  parseSpec,
  type Block,
  type ValidationContext,
  type WorkspaceSpec,
} from "@workspace-engine/core";
import { WorkspaceQueryClientProvider } from "../query/client";
import { WorkspaceStoreProvider } from "./context";
import { createBlankSpec, createInMemoryWorkspaceStore, type WorkspaceStore } from "./store";
import { useWorkspaceList } from "./useWorkspaceList";
import { useWorkspace } from "./useWorkspace";
import { useWorkspaceEditor, WorkspaceEditorSaveError } from "./useWorkspaceEditor";

afterEach(cleanup);

function sampleSpec(title: string): WorkspaceSpec {
  return parseSpec({
    specVersion: 1,
    title,
    blocks: [
      {
        id: "blk_a1",
        type: "CasesTable",
        frame: { x: 0, y: 0, w: 6, h: 4 },
        config: { title: "Cases" },
        binding: null,
      },
    ],
  });
}

const extraBlock: Block = parseSpec({
  specVersion: 1,
  title: "x",
  blocks: [
    { id: "blk_b2", type: "KpiCards", frame: { x: 6, y: 0, w: 6, h: 2 }, config: { cards: [{ alias: "total", label: "Total" }] }, binding: null },
  ],
}).blocks[0]!;

function makeWrapper(store: WorkspaceStore, validation?: ValidationContext) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <WorkspaceQueryClientProvider client={client}>
        <WorkspaceStoreProvider store={store} validation={validation}>
          {children}
        </WorkspaceStoreProvider>
      </WorkspaceQueryClientProvider>
    );
  };
}

describe("useWorkspaceList", () => {
  it("lists saved workspaces", async () => {
    const store = createInMemoryWorkspaceStore([
      { spec: sampleSpec("Alpha") },
      { spec: sampleSpec("Beta") },
    ]);
    const { result } = renderHook(() => useWorkspaceList(), { wrapper: makeWrapper(store) });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.items.map((i) => i.title).sort()).toEqual(["Alpha", "Beta"]);
  });
});

describe("useWorkspace", () => {
  it("loads a workspace by id and exposes its spec", async () => {
    const store = createInMemoryWorkspaceStore();
    const created = await store.create(sampleSpec("Gamma"));
    const { result } = renderHook(() => useWorkspace(created.id), { wrapper: makeWrapper(store) });

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.spec?.title).toBe("Gamma");
  });

  it("is idle for an undefined id", () => {
    const store = createInMemoryWorkspaceStore();
    const { result } = renderHook(() => useWorkspace(undefined), { wrapper: makeWrapper(store) });
    expect(result.current.status).toBe("idle");
    expect(result.current.isLoading).toBe(false);
  });

  it("refetch re-reads the saved workspace (refresh flow)", async () => {
    const store = createInMemoryWorkspaceStore();
    const created = await store.create(sampleSpec("Before"));
    const { result } = renderHook(() => useWorkspace(created.id), { wrapper: makeWrapper(store) });
    await waitFor(() => expect(result.current.spec?.title).toBe("Before"));

    await store.update(created.id, sampleSpec("After"));
    act(() => result.current.refetch());
    await waitFor(() => expect(result.current.spec?.title).toBe("After"));
  });
});

describe("useWorkspaceEditor", () => {
  it("tracks dirty state through mutations and reset", () => {
    const store = createInMemoryWorkspaceStore();
    const { result } = renderHook(
      () => useWorkspaceEditor({ initialSpec: sampleSpec("Draft") }),
      { wrapper: makeWrapper(store) },
    );

    expect(result.current.isDirty).toBe(false);
    act(() => result.current.setTitle("Renamed"));
    expect(result.current.draft.title).toBe("Renamed");
    expect(result.current.isDirty).toBe(true);

    act(() => result.current.reset());
    expect(result.current.draft.title).toBe("Draft");
    expect(result.current.isDirty).toBe(false);
  });

  it("adds, moves, and removes blocks", () => {
    const store = createInMemoryWorkspaceStore();
    const { result } = renderHook(
      () => useWorkspaceEditor({ initialSpec: sampleSpec("Draft") }),
      { wrapper: makeWrapper(store) },
    );

    act(() => result.current.addBlock(extraBlock));
    expect(result.current.draft.blocks).toHaveLength(2);
    act(() => result.current.moveBlock("blk_a1", { x: 0, y: 6, w: 12, h: 3 }));
    expect(result.current.draft.blocks[0]!.frame).toMatchObject({ y: 6, w: 12 });
    act(() => result.current.removeBlock("blk_b2"));
    expect(result.current.draft.blocks).toHaveLength(1);
  });

  it("saves an update and refreshes the list cache", async () => {
    const store = createInMemoryWorkspaceStore();
    const created = await store.create(sampleSpec("Original"));
    const { result } = renderHook(
      () => ({
        list: useWorkspaceList(),
        editor: useWorkspaceEditor({ id: created.id, initialSpec: created.spec }),
      }),
      { wrapper: makeWrapper(store) },
    );
    await waitFor(() => expect(result.current.list.items).toHaveLength(1));

    act(() => result.current.editor.setTitle("Renamed"));
    await act(async () => {
      await result.current.editor.save();
    });

    expect(result.current.editor.isDirty).toBe(false);
    expect((await store.get(created.id)).spec.title).toBe("Renamed");
    await waitFor(() =>
      expect(result.current.list.items[0]?.title).toBe("Renamed"),
    );
  });

  it("creates a new workspace when no id is given", async () => {
    const store = createInMemoryWorkspaceStore();
    const { result } = renderHook(
      () => useWorkspaceEditor({ initialSpec: sampleSpec("New one") }),
      { wrapper: makeWrapper(store) },
    );

    let createdId = "";
    await act(async () => {
      const record = await result.current.save();
      createdId = record.id;
    });
    expect(createdId).toMatch(/^ws_/);
    expect((await store.list())).toHaveLength(1);
  });

  it("reseeds from a changed initialSpec while clean, but never clobbers a dirty draft", () => {
    const store = createInMemoryWorkspaceStore();
    const { result, rerender } = renderHook(
      ({ spec }: { spec: WorkspaceSpec }) => useWorkspaceEditor({ initialSpec: spec }),
      { wrapper: makeWrapper(store), initialProps: { spec: sampleSpec("One") } },
    );
    expect(result.current.draft.title).toBe("One");

    // Clean: a new initialSpec value reseeds the draft (async load resolving).
    rerender({ spec: sampleSpec("Two") });
    expect(result.current.draft.title).toBe("Two");

    // Dirty: a later reseed must not discard the user's in-progress edits.
    act(() => result.current.setTitle("Edited"));
    rerender({ spec: sampleSpec("Three") });
    expect(result.current.draft.title).toBe("Edited");
  });

  it("rejects a save when the validated draft fails (empty blocks)", async () => {
    const store = createInMemoryWorkspaceStore();
    const validation: ValidationContext = { contracts: {} };
    const { result } = renderHook(
      () => useWorkspaceEditor({ initialSpec: createBlankSpec("Empty") }),
      { wrapper: makeWrapper(store, validation) },
    );

    await act(async () => {
      await expect(result.current.save()).rejects.toBeInstanceOf(
        WorkspaceEditorSaveError,
      );
    });
    await waitFor(() =>
      expect(result.current.saveError).toBeInstanceOf(WorkspaceEditorSaveError),
    );
    expect(await store.list()).toHaveLength(0);
  });
});
