/**
 * Demo-only seeding helper (Trello #79). Seeds the saved-workspaces store with
 * the three curated, hand-written specs that /workspaces renders — real specs
 * that pass the validation gate and render live data — so a cold machine can
 * show the /saved grid + reload story immediately, without first generating and
 * saving in the same session.
 *
 * Seeds through the SAME WorkspaceStore port the app uses (store.create), so a
 * seeded item is indistinguishable from a user-saved one: it opens, reloads, and
 * renders live. Deduped by title so re-clicking "Load demo examples" is a no-op
 * rather than piling up duplicates. Does not touch the store interface.
 */
import type { WorkspaceStore } from "@workspace-engine/react";
import { demoWorkspaces } from "./specs";

/** Titles of the workspaces this helper seeds (for tests / dedupe checks). */
export const DEMO_SEED_TITLES = demoWorkspaces.map((w) => w.spec.title);

/**
 * Seed any missing curated demo workspaces into the store. Returns how many
 * were added (0 if all were already present). Inserts in reverse so the first
 * demo ends up newest — store.create prepends — and the grid leads with
 * "Compliance Overview".
 */
export async function seedSavedWorkspaces(
  store: WorkspaceStore,
): Promise<number> {
  const existingTitles = new Set((await store.list()).map((s) => s.title));
  let added = 0;
  for (const w of [...demoWorkspaces].reverse()) {
    if (existingTitles.has(w.spec.title)) continue;
    await store.create(w.spec);
    added += 1;
  }
  return added;
}
