/**
 * @workspace-engine/db — Workspace Service persistence.
 *
 * All DB access for the service lives here: the Drizzle schema (with
 * tenant-scoped RLS policies), the tenant-scoped transaction helper, and the
 * operations layer. Services call operations; nothing above this package
 * writes SQL.
 */
export {
  createDbClient,
  type WorkspaceDb,
  type WorkspaceDbClient,
} from "./client.js";
export { withTenant, type TenantContext, type TenantTx } from "./tenant.js";
export {
  tenants,
  users,
  sessions,
  apiKeys,
  workspaces,
  workspaceVersions,
  workspaceShares,
  dataContracts,
  auditLog,
  usageEvents,
  telemetryEvents,
  workspaceServiceRole,
  type DBTenant,
  type DBUser,
  type DBSession,
  type DBApiKey,
  type DBWorkspace,
  type DBWorkspaceVersion,
  type DBWorkspaceShare,
  type DBDataContract,
  type DBAuditEntry,
  type DBUsageEvent,
  type DBTelemetryEvent,
  type StoredVerdict,
} from "./schema.js";
export {
  createWorkspace,
  getWorkspace,
  listWorkspaces,
  updateWorkspaceSpec,
  rollbackWorkspace,
  listWorkspaceVersions,
  getWorkspaceVersion,
  recordWorkspaceView,
  softDeleteWorkspace,
  duplicateWorkspace,
  requireWorkspaceAccess,
  WorkspaceNotFoundError,
  WorkspaceVersionNotFoundError,
  type WorkspaceWithHead,
  type CreateWorkspaceParams,
  type UpdateWorkspaceSpecParams,
} from "./operations/workspaces.js";
export {
  resolveWorkspaceRole,
  WorkspaceForbiddenError,
  type WorkspaceRole,
} from "./operations/access.js";
export {
  shareWorkspace,
  unshareWorkspace,
  listWorkspaceShares,
  setWorkspaceVisibility,
  type ShareWorkspaceParams,
} from "./operations/shares.js";
export {
  upsertDataContract,
  getDataContract,
  listDataContracts,
  removeDataContract,
  type UpsertDataContractParams,
} from "./operations/contracts.js";
export {
  getGenerationAllowance,
  recordGenerationUsage,
  getUsageSummary,
  setTenantLimits,
  GenerationLimitError,
  type GenerationAllowance,
  type GenerationDenialReason,
  type RecordGenerationParams,
  type UsageSummary,
} from "./operations/usage.js";
export {
  recordTelemetryEvents,
  getTelemetrySummary,
  type TelemetryEventInput,
  type TelemetrySummary,
} from "./operations/telemetry.js";
export {
  createApiKey,
  resolveApiKey,
  revokeApiKey,
  listApiKeys,
  type ApiKeyScope,
  type CreatedApiKey,
  type ResolvedApiKey,
  type ApiKeyMetadata,
  type OwnerWriter,
} from "./operations/api-keys.js";
export {
  provisionTenant,
  slugify,
  SLUG_PATTERN,
  InvalidSlugError,
  TenantSlugTakenError,
  type ProvisionTenantParams,
  type ProvisionedTenant,
} from "./operations/signup.js";
export {
  createSession,
  resolveSession,
  deleteSession,
  deleteUserSessions,
  getUserByExternalId,
  listTenantMembers,
  type CreatedSession,
  type SessionUser,
} from "./operations/sessions.js";
export {
  writeAudit,
  listAuditEntries,
  type AuditAction,
  type WriteAuditParams,
  type ListAuditParams,
} from "./operations/audit.js";
