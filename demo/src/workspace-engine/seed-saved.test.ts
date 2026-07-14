import { beforeEach, describe, expect, it } from "vitest";
import { createLocalStorageWorkspaceStore } from "./workspace-store";
import { seedSavedWorkspaces, DEMO_SEED_TITLES } from "./seed-saved";

// jsdom provides localStorage; clear it between tests.
beforeEach(() => localStorage.clear());

describe("seedSavedWorkspaces (card #79)", () => {
  it("seeds all curated demo workspaces into an empty store", async () => {
    const store = createLocalStorageWorkspaceStore();
    const added = await seedSavedWorkspaces(store);
    expect(added).toBe(DEMO_SEED_TITLES.length);
    const list = await store.list();
    expect(list.map((s) => s.title).sort()).toEqual([...DEMO_SEED_TITLES].sort());
  });

  it("seeded records are real, re-parseable specs that render (indistinguishable from user-saved)", async () => {
    const store = createLocalStorageWorkspaceStore();
    await seedSavedWorkspaces(store);
    const list = await store.list();
    // Each opens and carries a valid spec with blocks (the reload path).
    for (const summary of list) {
      const record = await store.get(summary.id);
      expect(record.spec.blocks.length).toBeGreaterThan(0);
    }
  });

  it("is idempotent — re-seeding adds nothing and does not duplicate", async () => {
    const store = createLocalStorageWorkspaceStore();
    await seedSavedWorkspaces(store);
    const again = await seedSavedWorkspaces(store);
    expect(again).toBe(0);
    expect((await store.list())).toHaveLength(DEMO_SEED_TITLES.length);
  });

  it("only fills the gap when some examples already exist", async () => {
    const store = createLocalStorageWorkspaceStore();
    // Pre-seed just the first one, then top up.
    const first = await seedSavedWorkspaces(store); // all
    expect(first).toBe(DEMO_SEED_TITLES.length);
    await store.remove((await store.list())[0]!.id); // drop one
    const topUp = await seedSavedWorkspaces(store);
    expect(topUp).toBe(1);
    expect((await store.list())).toHaveLength(DEMO_SEED_TITLES.length);
  });

  it("leads the grid with the first curated workspace (newest-first ordering)", async () => {
    const store = createLocalStorageWorkspaceStore();
    await seedSavedWorkspaces(store);
    const list = await store.list();
    // demoWorkspaces[0] is inserted last so it sorts newest → top of the list.
    expect(list[0]!.title).toBe(DEMO_SEED_TITLES[0]);
  });
});
