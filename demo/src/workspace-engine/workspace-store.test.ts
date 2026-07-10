import { beforeEach, describe, expect, it } from "vitest";
import { createLocalStorageWorkspaceStore } from "./workspace-store";
import { demoWorkspaces } from "./specs";

// jsdom provides localStorage; clear it between tests.
beforeEach(() => localStorage.clear());

describe("createLocalStorageWorkspaceStore — persisted round-trip (card #21)", () => {
  it("create → get returns an identical, re-parsed spec", async () => {
    const store = createLocalStorageWorkspaceStore();
    const spec = demoWorkspaces[0]!.spec;
    const created = await store.create(spec);
    const fetched = await store.get(created.id);
    expect(fetched.title).toBe(spec.title);
    expect(fetched.spec.blocks.length).toBe(spec.blocks.length);
    expect(fetched.spec).toEqual(spec);
  });

  it("survives a 'reload' — a fresh store instance sees persisted records", async () => {
    const created = await createLocalStorageWorkspaceStore().create(demoWorkspaces[0]!.spec);
    // New instance = the round-trip across a page reload.
    const reloaded = createLocalStorageWorkspaceStore();
    const list = await reloaded.list();
    expect(list.map((s) => s.id)).toContain(created.id);
    expect((await reloaded.get(created.id)).spec).toEqual(demoWorkspaces[0]!.spec);
  });

  it("lists newest-first and removes", async () => {
    const store = createLocalStorageWorkspaceStore();
    const a = await store.create(demoWorkspaces[0]!.spec);
    const b = await store.create(demoWorkspaces[1]!.spec);
    const list = await store.list();
    expect(list[0]!.id).toBe(b.id); // newest first
    await store.remove(a.id);
    expect((await store.list()).map((s) => s.id)).toEqual([b.id]);
  });
});
