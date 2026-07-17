/**
 * localStorage-backed WorkspaceStore (card #21).
 *
 * The SDK defines the WorkspaceStore port (list/get/create/update/remove) and
 * ships an in-memory implementation; Phase 4 will swap in the HTTP-backed
 * Workspace Service. For the demo's save→reload round-trip we need persistence
 * that survives a real page reload, so this mirrors the in-memory store but
 * writes through to localStorage. Specs round-trip the canonical serializer on
 * write, so stored copies are detached and always re-parse to a valid spec.
 */
import {
  parseSpec,
  serializeSpec,
  type WorkspaceSpec,
} from "@workspace-engine/core";
import { createHttpWorkspaceStore } from "@workspace-engine/client";
import {
  WorkspaceNotFoundError,
  type WorkspaceRecord,
  type WorkspaceStore,
  type WorkspaceSummary,
} from "@workspace-engine/react";

/** Service mode is on when the demo is pointed at a Workspace Service. */
export interface ServiceModeConfig {
  baseUrl: string;
  apiKey: string;
}

/**
 * Read service-mode config from the build-time env (NEXT_PUBLIC_ vars are
 * inlined by Next). The demo API key is client-exposed by design — same
 * trust model as NEXT_PUBLIC_TAMBO_API_KEY, appropriate for the
 * unauthenticated demo, not a production posture.
 * @returns The config, or null to stay on localStorage.
 */
export function serviceModeConfig(): ServiceModeConfig | null {
  const baseUrl = process.env.NEXT_PUBLIC_WORKSPACE_API_URL;
  const apiKey = process.env.NEXT_PUBLIC_WORKSPACE_API_KEY;
  return baseUrl && apiKey ? { baseUrl, apiKey } : null;
}

/**
 * The Phase 4 port swap, demo side: the SAME WorkspaceStore port, backed by
 * the Workspace Service when configured (durable Postgres, versioned,
 * audited, RLS-isolated) and by localStorage otherwise (tests, cold clones).
 * @returns The store for this end user.
 */
export function createDemoWorkspaceStore(
  userKey: string,
  config: ServiceModeConfig | null = serviceModeConfig(),
): WorkspaceStore {
  if (config) {
    return createHttpWorkspaceStore({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      userId: userKey,
    });
  }
  return createLocalStorageWorkspaceStore();
}

const KEY = "workspace-engine:saved-workspaces";

interface StoredRecord {
  id: string;
  title: string;
  /** Canonical JSON string (serializeSpec output), so reads always re-parse. */
  spec: string;
  updatedAt: number;
}

function readAll(): StoredRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: StoredRecord[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(records));
}

const toRecord = (s: StoredRecord): WorkspaceRecord => ({
  id: s.id,
  title: s.title,
  spec: parseSpec(s.spec),
  updatedAt: s.updatedAt,
});

/** A WorkspaceStore persisting to localStorage under a single key. */
export function createLocalStorageWorkspaceStore(): WorkspaceStore {
  const store = (spec: WorkspaceSpec, id: string): StoredRecord => ({
    id,
    title: spec.title,
    spec: serializeSpec(spec),
    updatedAt: Date.now(),
  });
  const nextId = () => `ws_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  return {
    async list(): Promise<WorkspaceSummary[]> {
      return readAll()
        .map(({ id, title, updatedAt }) => ({ id, title, updatedAt }))
        .sort((a, b) => b.updatedAt - a.updatedAt);
    },
    async get(id) {
      const found = readAll().find((r) => r.id === id);
      if (!found) throw new WorkspaceNotFoundError(id);
      return toRecord(found);
    },
    async create(spec) {
      const record = store(spec, nextId());
      writeAll([record, ...readAll()]);
      return toRecord(record);
    },
    async update(id, spec) {
      const all = readAll();
      if (!all.some((r) => r.id === id)) throw new WorkspaceNotFoundError(id);
      const record = store(spec, id);
      writeAll(all.map((r) => (r.id === id ? record : r)));
      return toRecord(record);
    },
    async remove(id) {
      const all = readAll();
      if (!all.some((r) => r.id === id)) throw new WorkspaceNotFoundError(id);
      writeAll(all.filter((r) => r.id !== id));
    },
  };
}
