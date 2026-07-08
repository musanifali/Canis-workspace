import {
  serializeSpec,
  parseSpec,
  type WorkspaceSpec,
} from "@workspace-engine/core";

/**
 * Persistence port for saved workspaces.
 *
 * The real backend is the Workspace Service (Phase 4); the SDK talks to it
 * through this narrow interface so the headless hooks (useWorkspaceList/
 * useWorkspace/useWorkspaceEditor) don't care whether persistence is HTTP, the
 * host's own store, or the in-memory implementation below. All methods are
 * async and reject on failure — never throw synchronously.
 */
export interface WorkspaceStore {
  list(): Promise<WorkspaceSummary[]>;
  get(id: string): Promise<WorkspaceRecord>;
  create(spec: WorkspaceSpec): Promise<WorkspaceRecord>;
  update(id: string, spec: WorkspaceSpec): Promise<WorkspaceRecord>;
  remove(id: string): Promise<void>;
}

export interface WorkspaceRecord {
  id: string;
  title: string;
  spec: WorkspaceSpec;
  /** Epoch millis of the last save. */
  updatedAt: number;
}

/** Lightweight list entry — no spec payload, for cheap listing. */
export type WorkspaceSummary = Omit<WorkspaceRecord, "spec">;

/** Thrown by the in-memory store's get/update/remove for an unknown id. */
export class WorkspaceNotFoundError extends Error {
  constructor(readonly id: string) {
    super(`workspace not found: "${id}"`);
    this.name = "WorkspaceNotFoundError";
  }
}

/**
 * A fresh, type-valid draft spec for the "new workspace" flow. It has no blocks
 * yet, so it is deliberately NOT schema-valid until the editor adds one — save()
 * gates that. Use it as `initialSpec` for useWorkspaceEditor when creating.
 */
export function createBlankSpec(title = "Untitled workspace"): WorkspaceSpec {
  return {
    specVersion: 1,
    title,
    timezone: "viewer",
    refresh: { mode: "manual" },
    layout: { columns: 12 },
    blocks: [],
  };
}

/**
 * In-memory WorkspaceStore for the demo app, devMode (#40), and tests. Specs are
 * round-tripped through the canonical serializer on write so stored copies are
 * detached from caller-held objects (mutating a draft after save can't corrupt
 * the store). Phase 4 swaps this for an HTTP-backed implementation.
 */
export function createInMemoryWorkspaceStore(
  seed: readonly { id?: string; spec: WorkspaceSpec }[] = [],
): WorkspaceStore {
  const records = new Map<string, WorkspaceRecord>();
  let counter = 0;
  const nextId = () => `ws_${(++counter).toString(36)}`;
  const clone = (spec: WorkspaceSpec): WorkspaceSpec => parseSpec(serializeSpec(spec));

  for (const entry of seed) {
    const id = entry.id ?? nextId();
    records.set(id, {
      id,
      title: entry.spec.title,
      spec: clone(entry.spec),
      updatedAt: Date.now(),
    });
  }

  return {
    async list() {
      return [...records.values()]
        .map(({ id, title, updatedAt }) => ({ id, title, updatedAt }))
        .sort((a, b) => b.updatedAt - a.updatedAt);
    },
    async get(id) {
      const record = records.get(id);
      if (!record) throw new WorkspaceNotFoundError(id);
      return { ...record, spec: clone(record.spec) };
    },
    async create(spec) {
      const id = nextId();
      const record: WorkspaceRecord = {
        id,
        title: spec.title,
        spec: clone(spec),
        updatedAt: Date.now(),
      };
      records.set(id, record);
      return { ...record, spec: clone(record.spec) };
    },
    async update(id, spec) {
      if (!records.has(id)) throw new WorkspaceNotFoundError(id);
      const record: WorkspaceRecord = {
        id,
        title: spec.title,
        spec: clone(spec),
        updatedAt: Date.now(),
      };
      records.set(id, record);
      return { ...record, spec: clone(record.spec) };
    },
    async remove(id) {
      if (!records.delete(id)) throw new WorkspaceNotFoundError(id);
    },
  };
}
