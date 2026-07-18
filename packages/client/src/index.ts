/**
 * @workspace-engine/client — typed client for the Workspace Service /v1 API.
 *
 * Types are generated from apps/api/openapi.json (the contract's source of
 * truth); `createHttpWorkspaceStore` is the HTTP-backed implementation of the
 * SDK's WorkspaceStore port.
 */
export {
  createWorkspaceServiceClient,
  createHttpWorkspaceStore,
  WorkspaceServiceError,
  WorkspaceNotFoundError,
  GenerationLimitedError,
  type GenerationAllowance,
  type UsageSummary,
  type DataContract,
  type AuditEntry,
  type ListAuditParams,
  type WorkspaceServiceClient,
  type WorkspaceServiceClientOptions,
  type SaveWorkspaceParams,
  type HttpWorkspaceStore,
  type WorkspaceRecord,
  type WorkspaceSummary,
  type WorkspaceVersion,
  type WorkspaceShare,
  type WorkspaceVisibility,
  type ShareParams,
} from "./http-store.js";
