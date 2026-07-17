import {
  parseSpec,
  serializeSpec,
  type WorkspaceSpec,
} from "@workspace-engine/core";
import type { components } from "./generated/v1.js";

type RecordDto = components["schemas"]["WorkspaceRecordDto"];
type SummaryDto = components["schemas"]["WorkspaceSummaryDto"];
type VersionDto = components["schemas"]["WorkspaceVersionDto"];
type ShareDto = components["schemas"]["WorkspaceShareDto"];

export type WorkspaceShare = ShareDto;
export type WorkspaceVisibility = "private" | "team" | "org";

export interface ShareParams {
  subjectType: "user" | "team";
  subjectId: string;
  role: "viewer" | "editor";
}

/** Matches the SDK's WorkspaceStore port record shape. */
export interface WorkspaceRecord {
  id: string;
  title: string;
  spec: WorkspaceSpec;
  /** Epoch millis of the last save. */
  updatedAt: number;
}
export type WorkspaceSummary = Omit<WorkspaceRecord, "spec">;

export interface WorkspaceVersion {
  versionNumber: number;
  prompt: string | null;
  authorUserId: string;
  createdAt: string;
  specVersion: number;
  spec: WorkspaceSpec;
}

/** Any non-2xx response from the service. */
export class WorkspaceServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "WorkspaceServiceError";
  }
}

/** 404 — unknown or deleted workspace/version. */
export class WorkspaceNotFoundError extends WorkspaceServiceError {
  constructor(readonly id: string, status: number, body: unknown) {
    super(`workspace not found: "${id}"`, status, body);
    this.name = "WorkspaceNotFoundError";
  }
}

export interface WorkspaceServiceClientOptions {
  /** Service origin, e.g. "http://localhost:8270". No trailing slash needed. */
  baseUrl: string;
  apiKey: string;
  /** Acting end user within the tenant. */
  userId: string;
  /** Override for tests/SSR; defaults to globalThis.fetch. */
  fetch?: typeof fetch;
}

export interface SaveWorkspaceParams {
  spec: WorkspaceSpec;
  prompt?: string;
  createdFromThreadId?: string;
}

export interface WorkspaceServiceClient {
  listWorkspaces(): Promise<WorkspaceSummary[]>;
  getWorkspace(id: string): Promise<WorkspaceRecord>;
  createWorkspace(params: SaveWorkspaceParams): Promise<WorkspaceRecord>;
  updateWorkspace(
    id: string,
    params: Omit<SaveWorkspaceParams, "createdFromThreadId">,
  ): Promise<WorkspaceRecord>;
  deleteWorkspace(id: string): Promise<void>;
  listVersions(id: string): Promise<WorkspaceVersion[]>;
  rollbackWorkspace(id: string, toVersion: number): Promise<WorkspaceRecord>;
  listShares(id: string): Promise<WorkspaceShare[]>;
  shareWorkspace(id: string, params: ShareParams): Promise<WorkspaceShare>;
  unshareWorkspace(id: string, shareId: string): Promise<void>;
  setVisibility(
    id: string,
    visibility: WorkspaceVisibility,
  ): Promise<WorkspaceRecord>;
  duplicateWorkspace(id: string, title?: string): Promise<WorkspaceRecord>;
}

/**
 * Typed /v1 client. Response payload types come from the generated OpenAPI
 * types (src/generated/v1.d.ts — `npm run generate` regenerates them from
 * apps/api/openapi.json); specs are re-parsed through core's canonical
 * parseSpec so a corrupted payload can never flow into the renderer.
 * @returns The client.
 */
export function createWorkspaceServiceClient(
  options: WorkspaceServiceClientOptions,
): WorkspaceServiceClient {
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const doFetch = options.fetch ?? globalThis.fetch;

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const response = await doFetch(`${baseUrl}/v1${path}`, {
      method,
      headers: {
        "x-api-key": options.apiKey,
        "x-user-id": options.userId,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const payload =
      response.status === 204 ? undefined : await response.json().catch(() => undefined);
    if (!response.ok) {
      const id = path.split("/")[2] ?? path;
      if (response.status === 404) {
        throw new WorkspaceNotFoundError(id, response.status, payload);
      }
      throw new WorkspaceServiceError(
        `workspace service ${method} ${path} failed with ${response.status}`,
        response.status,
        payload,
      );
    }
    return payload as T;
  }

  const toRecord = (dto: RecordDto): WorkspaceRecord => ({
    id: dto.id,
    title: dto.title,
    spec: parseSpec(dto.spec),
    updatedAt: dto.updatedAt,
  });

  return {
    async listWorkspaces() {
      const dtos = await request<SummaryDto[]>("GET", "/workspaces");
      return dtos.map(({ id, title, updatedAt }) => ({ id, title, updatedAt }));
    },
    async getWorkspace(id) {
      return toRecord(await request<RecordDto>("GET", `/workspaces/${encodeURIComponent(id)}`));
    },
    async createWorkspace(params) {
      return toRecord(
        await request<RecordDto>("POST", "/workspaces", {
          spec: parseSpec(serializeSpec(params.spec)),
          ...(params.prompt ? { prompt: params.prompt } : {}),
          ...(params.createdFromThreadId
            ? { createdFromThreadId: params.createdFromThreadId }
            : {}),
        }),
      );
    },
    async updateWorkspace(id, params) {
      return toRecord(
        await request<RecordDto>("PUT", `/workspaces/${encodeURIComponent(id)}`, {
          spec: parseSpec(serializeSpec(params.spec)),
          ...(params.prompt ? { prompt: params.prompt } : {}),
        }),
      );
    },
    async deleteWorkspace(id) {
      await request<void>("DELETE", `/workspaces/${encodeURIComponent(id)}`);
    },
    async listVersions(id) {
      const dtos = await request<VersionDto[]>(
        "GET",
        `/workspaces/${encodeURIComponent(id)}/versions`,
      );
      return dtos.map((dto) => ({
        versionNumber: dto.versionNumber,
        prompt: dto.prompt ?? null,
        authorUserId: dto.authorUserId,
        createdAt: dto.createdAt,
        specVersion: dto.specVersion,
        spec: parseSpec(dto.spec),
      }));
    },
    async rollbackWorkspace(id, toVersion) {
      return toRecord(
        await request<RecordDto>(
          "POST",
          `/workspaces/${encodeURIComponent(id)}/rollback`,
          { toVersion },
        ),
      );
    },
    async listShares(id) {
      return await request<ShareDto[]>(
        "GET",
        `/workspaces/${encodeURIComponent(id)}/shares`,
      );
    },
    async shareWorkspace(id, params) {
      return await request<ShareDto>(
        "POST",
        `/workspaces/${encodeURIComponent(id)}/shares`,
        params,
      );
    },
    async unshareWorkspace(id, shareId) {
      await request<void>(
        "DELETE",
        `/workspaces/${encodeURIComponent(id)}/shares/${encodeURIComponent(shareId)}`,
      );
    },
    async setVisibility(id, visibility) {
      return toRecord(
        await request<RecordDto>(
          "PUT",
          `/workspaces/${encodeURIComponent(id)}/visibility`,
          { visibility },
        ),
      );
    },
    async duplicateWorkspace(id, title) {
      return toRecord(
        await request<RecordDto>(
          "POST",
          `/workspaces/${encodeURIComponent(id)}/duplicate`,
          title ? { title } : {},
        ),
      );
    },
  };
}

/** The SDK's WorkspaceStore port shape (structural — no react dependency). */
export interface HttpWorkspaceStore {
  list(): Promise<WorkspaceSummary[]>;
  get(id: string): Promise<WorkspaceRecord>;
  create(spec: WorkspaceSpec): Promise<WorkspaceRecord>;
  update(id: string, spec: WorkspaceSpec): Promise<WorkspaceRecord>;
  remove(id: string): Promise<void>;
}

/**
 * The real backend behind the SDK's WorkspaceStore port: same five methods
 * the localStorage/in-memory stores implement, HTTP-backed. Swapping this in
 * is the Phase 4 port swap.
 * @returns A WorkspaceStore-compatible store talking to the service.
 */
export function createHttpWorkspaceStore(
  options: WorkspaceServiceClientOptions,
): HttpWorkspaceStore {
  const client = createWorkspaceServiceClient(options);
  return {
    list: () => client.listWorkspaces(),
    get: (id) => client.getWorkspace(id),
    create: (spec) => client.createWorkspace({ spec }),
    update: (id, spec) => client.updateWorkspace(id, { spec }),
    remove: (id) => client.deleteWorkspace(id),
  };
}
