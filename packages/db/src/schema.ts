/**
 * Workspace Service schema (cards #24/#27/#25).
 *
 * Design invariants:
 * - Every row carries `tenant_id`, and every table has row-level-security
 *   policies scoped to `current_setting('app.tenant_id')` for the non-owner
 *   `workspace_service` role. Isolation is enforced by Postgres, not just the
 *   service layer (mirrors the vendored Tambo pgRole/current_setting pattern).
 * - `workspace_versions` and `audit_log` are append-only: they have SELECT and
 *   INSERT policies only. With RLS enabled, a command with no matching policy
 *   is denied, so UPDATE/DELETE are impossible for the service role at the DB
 *   level — not merely absent from the operations layer.
 * - Specs are stored as validated jsonb snapshots (frozen Spec v1). Blocks are
 *   deliberately NOT shredded into rows in v1; the spec document is the unit
 *   of storage, and core's lazy migrations run at read time.
 * - `workspaces.head_version` is a version *number* (not an id FK) to avoid a
 *   circular FK with workspace_versions; rollback = repoint the number.
 */
import type {
  ValidationNote,
  WorkspaceSpec,
} from "@workspace-engine/core";
import { sql } from "drizzle-orm";
import {
  bigserial,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgPolicy,
  pgRole,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

/**
 * Tenant scoping for RLS policies. Fail-closed in both possible states of a
 * connection: on a fresh connection the unset GUC makes `current_setting`
 * error; on a connection that has run a transaction-local set_config before,
 * the reset value is '' — which matches no tenant_id, so the query sees zero
 * rows. Either way, no tenant setting = no data (proven in rls.test.ts).
 */
export const tenantIdSetting = sql`current_setting('app.tenant_id')`;

/**
 * The role the operations layer runs under (via `SET LOCAL ROLE` inside each
 * transaction — see tenant.ts). Created in the custom migration
 * 0000_workspace-service-role.sql, hence `.existing()`.
 */
export const workspaceServiceRole = pgRole("workspace_service").existing();

/** The verdict stored with every version — always a BUILD (save-gated). */
export interface StoredVerdict {
  verdict: "BUILD";
  notes: readonly ValidationNote[];
}

export const tenants = pgTable(
  "tenants",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    /**
     * URL-safe org handle, unique across all tenants (#91 self-signup). Chosen
     * at signup and immutable; the public identifier for a tenant.
     */
    slug: text("slug").notNull().unique(),
    /**
     * Billing tier (#94). Drives the effective caps via core's PLAN_CAPS,
     * resolved at read time — a plan change (even a raw SQL UPDATE) takes
     * effect on the next allowance check, no restart. Defaults to "free" so a
     * tenant created without a plan fails CLOSED on cost; signup sets it
     * explicitly, seeds/tests use "internal".
     */
    plan: text("plan", { enum: ["free", "pro", "internal"] })
      .notNull()
      .default("free"),
    /**
     * Explicit per-tenant budget OVERRIDE (#48/#94). null = follow the plan's
     * cap; a number wins over the plan. Kept for design-partner one-offs.
     */
    monthlyGenerationBudget: integer("monthly_generation_budget"),
    /** Per-user generation events per minute (#48). */
    generationRatePerMinute: integer("generation_rate_per_minute")
      .default(20)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Tenants are created/administered on the owner connection; the service
    // role can only see its own row.
    pgPolicy("tenants_service_select", {
      to: workspaceServiceRole,
      for: "select",
      using: sql`${table.id} = ${tenantIdSetting}`,
    }),
  ],
);
export type DBTenant = typeof tenants.$inferSelect;

/**
 * People who can sign into the dashboard for a tenant (#91 self-signup, #93
 * sessions). Like tenants and api_keys, users are provisioned and read on the
 * OWNER connection — the signup path runs before any tenant context exists,
 * and session lookup resolves a user the same way key resolution resolves a
 * tenant. Hence only a tenant-scoped SELECT policy for the service role.
 */
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    /**
     * Stable identity from the auth provider, `"<provider>:<id>"` — e.g.
     * `"github:12345"`. Uses the provider's numeric id, not the handle, so a
     * rename doesn't orphan the account. Globally unique: one external
     * identity maps to exactly one user (team invites / multi-tenant
     * membership are a documented fast-follow, not v1).
     */
    externalId: text("external_id").notNull().unique(),
    email: text("email"),
    name: text("name"),
    /** owner = the signer-upper (billing, member list); member = invited later. */
    role: text("role", { enum: ["owner", "member"] })
      .notNull()
      .default("member"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("users_tenant_id_idx").on(table.tenantId),
    pgPolicy("users_service_select", {
      to: workspaceServiceRole,
      for: "select",
      using: sql`${table.tenantId} = ${tenantIdSetting}`,
    }),
  ],
);
export type DBUser = typeof users.$inferSelect;

/**
 * Dashboard login sessions (#93). Server-side so logout is a real revocation
 * (delete the row) and a stolen cookie dies the moment the user signs out —
 * not something a stateless JWT could offer. Managed on the OWNER connection
 * (the dashboard resolves a session before any tenant context exists), so no
 * RLS policy; only the id **hash** is stored, never the raw token.
 */
export const sessions = pgTable(
  "sessions",
  {
    /** sha256 hex of the opaque session token; the raw token lives only in the cookie. */
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    /** Denormalized from the user so session resolution needs no join for scoping. */
    tenantId: text("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);
export type DBSession = typeof sessions.$inferSelect;

export const apiKeys = pgTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    name: text("name").notNull(),
    /**
     * Key power domain: "runtime" (workspaces + telemetry ingest — the most a
     * browser-adjacent key can do) vs "admin" (adds the contracts registry,
     * audit, usage, telemetry summary — dashboard/CLI/CI credentials).
     * Defaults to "admin" so keys minted before scopes existed keep working.
     */
    scope: text("scope", { enum: ["runtime", "admin"] })
      .notNull()
      .default("admin"),
    /** sha256 hex of the raw key — the raw key is shown once and never stored. */
    keyHash: text("key_hash").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    /**
     * Last time this key resolved a request (#92 key-management UI). Updated
     * throttled on the auth hot path — at most once per throttle window per
     * key — so a busy key doesn't amplify into a write per request.
     */
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    index("api_keys_tenant_id_idx").on(table.tenantId),
    // Key resolution runs on the owner connection BEFORE a tenant is known;
    // the service role can only list its own tenant's keys (metadata, hashes
    // only). No insert/update/delete: key management is an admin operation.
    pgPolicy("api_keys_service_select", {
      to: workspaceServiceRole,
      for: "select",
      using: sql`${table.tenantId} = ${tenantIdSetting}`,
    }),
  ],
);
export type DBApiKey = typeof apiKeys.$inferSelect;

export const workspaces = pgTable(
  "workspaces",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    /** Denormalized from the head version's spec.title for cheap listing. */
    title: text("title").notNull(),
    /** Version number the workspace currently points at (rollback = repoint). */
    headVersion: integer("head_version").notNull(),
    ownerUserId: text("owner_user_id").notNull(),
    visibility: text("visibility", { enum: ["private", "team", "org"] })
      .default("private")
      .notNull(),
    /** Links back to the Tambo thread the workspace was generated in. */
    createdFromThreadId: text("created_from_thread_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    /** Soft delete — versions and audit history are never destroyed. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("workspaces_tenant_id_idx").on(table.tenantId),
    // Composite target for child tables' (workspace_id, tenant_id) FKs: FK
    // checks run as the table owner and bypass RLS, so without this a tenant
    // could attach child rows to another tenant's workspace.
    unique("workspaces_id_tenant_unique").on(table.id, table.tenantId),
    check("workspaces_head_version_positive", sql`${table.headVersion} >= 1`),
    pgPolicy("workspaces_service_select", {
      to: workspaceServiceRole,
      for: "select",
      using: sql`${table.tenantId} = ${tenantIdSetting}`,
    }),
    pgPolicy("workspaces_service_insert", {
      to: workspaceServiceRole,
      for: "insert",
      withCheck: sql`${table.tenantId} = ${tenantIdSetting}`,
    }),
    pgPolicy("workspaces_service_update", {
      to: workspaceServiceRole,
      for: "update",
      using: sql`${table.tenantId} = ${tenantIdSetting}`,
      withCheck: sql`${table.tenantId} = ${tenantIdSetting}`,
    }),
    // No DELETE policy: workspaces are soft-deleted (deleted_at), never
    // hard-deleted by the service role.
  ],
);
export type DBWorkspace = typeof workspaces.$inferSelect;

export const workspaceVersions = pgTable(
  "workspace_versions",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    tenantId: text("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    versionNumber: integer("version_number").notNull(),
    /** The validated Spec v1 document, stored whole (never rewritten). */
    spec: jsonb("spec").$type<WorkspaceSpec>().notNull(),
    /** spec.specVersion, extracted so lazy-migration reads can filter cheaply. */
    specVersion: integer("spec_version").notNull(),
    /** The NL prompt that produced this version; null for manual edits. */
    prompt: text("prompt"),
    verdict: jsonb("verdict").$type<StoredVerdict>().notNull(),
    authorUserId: text("author_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    // No updated_at: versions are immutable snapshots.
  },
  (table) => [
    // Composite FK: a version can only belong to a workspace of the SAME
    // tenant — closes the FK-bypasses-RLS forgery path.
    foreignKey({
      name: "workspace_versions_workspace_tenant_fk",
      columns: [table.workspaceId, table.tenantId],
      foreignColumns: [workspaces.id, workspaces.tenantId],
    }),
    unique("workspace_versions_workspace_version_unique").on(
      table.workspaceId,
      table.versionNumber,
    ),
    index("workspace_versions_tenant_id_idx").on(table.tenantId),
    index("workspace_versions_workspace_id_idx").on(table.workspaceId),
    check(
      "workspace_versions_version_positive",
      sql`${table.versionNumber} >= 1`,
    ),
    // Append-only: SELECT + INSERT policies only. No UPDATE/DELETE policy
    // exists, so RLS denies those commands for the service role outright.
    pgPolicy("workspace_versions_service_select", {
      to: workspaceServiceRole,
      for: "select",
      using: sql`${table.tenantId} = ${tenantIdSetting}`,
    }),
    pgPolicy("workspace_versions_service_insert", {
      to: workspaceServiceRole,
      for: "insert",
      withCheck: sql`${table.tenantId} = ${tenantIdSetting}`,
    }),
  ],
);
export type DBWorkspaceVersion = typeof workspaceVersions.$inferSelect;

export const workspaceShares = pgTable(
  "workspace_shares",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    tenantId: text("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    subjectType: text("subject_type", { enum: ["user", "team"] }).notNull(),
    /** User id or team id the grant applies to (org-wide uses visibility). */
    subjectId: text("subject_id").notNull(),
    role: text("role", { enum: ["viewer", "editor"] }).notNull(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Same composite FK rationale as workspace_versions.
    foreignKey({
      name: "workspace_shares_workspace_tenant_fk",
      columns: [table.workspaceId, table.tenantId],
      foreignColumns: [workspaces.id, workspaces.tenantId],
    }),
    unique("workspace_shares_subject_unique").on(
      table.workspaceId,
      table.subjectType,
      table.subjectId,
    ),
    index("workspace_shares_tenant_id_idx").on(table.tenantId),
    index("workspace_shares_workspace_id_idx").on(table.workspaceId),
    pgPolicy("workspace_shares_service_select", {
      to: workspaceServiceRole,
      for: "select",
      using: sql`${table.tenantId} = ${tenantIdSetting}`,
    }),
    pgPolicy("workspace_shares_service_insert", {
      to: workspaceServiceRole,
      for: "insert",
      withCheck: sql`${table.tenantId} = ${tenantIdSetting}`,
    }),
    pgPolicy("workspace_shares_service_update", {
      to: workspaceServiceRole,
      for: "update",
      using: sql`${table.tenantId} = ${tenantIdSetting}`,
      withCheck: sql`${table.tenantId} = ${tenantIdSetting}`,
    }),
    pgPolicy("workspace_shares_service_delete", {
      to: workspaceServiceRole,
      for: "delete",
      using: sql`${table.tenantId} = ${tenantIdSetting}`,
    }),
  ],
);
export type DBWorkspaceShare = typeof workspaceShares.$inferSelect;

export const dataContracts = pgTable(
  "data_contracts",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    entityName: text("entity_name").notNull(),
    /**
     * The tenant-registered contract surface (defineEntity args: fields,
     * capabilities, limits) as jsonb. The executable fetch() never lives
     * here — ADR-4: vendor code + data stay on the vendor's side.
     */
    definition: jsonb("definition").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("data_contracts_tenant_entity_unique").on(
      table.tenantId,
      table.entityName,
    ),
    index("data_contracts_tenant_id_idx").on(table.tenantId),
    pgPolicy("data_contracts_service_select", {
      to: workspaceServiceRole,
      for: "select",
      using: sql`${table.tenantId} = ${tenantIdSetting}`,
    }),
    pgPolicy("data_contracts_service_insert", {
      to: workspaceServiceRole,
      for: "insert",
      withCheck: sql`${table.tenantId} = ${tenantIdSetting}`,
    }),
    pgPolicy("data_contracts_service_update", {
      to: workspaceServiceRole,
      for: "update",
      using: sql`${table.tenantId} = ${tenantIdSetting}`,
      withCheck: sql`${table.tenantId} = ${tenantIdSetting}`,
    }),
    pgPolicy("data_contracts_service_delete", {
      to: workspaceServiceRole,
      for: "delete",
      using: sql`${table.tenantId} = ${tenantIdSetting}`,
    }),
  ],
);
export type DBDataContract = typeof dataContracts.$inferSelect;

export const usageEvents = pgTable(
  "usage_events",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    tenantId: text("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    userId: text("user_id").notNull(),
    /** Generation events cost money; saved workspaces cost ZERO at read time
     * (two-phase design) — reads are deliberately never recorded here. */
    kind: text("kind", { enum: ["generation"] }).notNull(),
    workspaceId: text("workspace_id"),
    costCents: integer("cost_cents").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("usage_events_tenant_created_idx").on(table.tenantId, table.createdAt),
    index("usage_events_tenant_user_created_idx").on(
      table.tenantId,
      table.userId,
      table.createdAt,
    ),
    index("usage_events_workspace_id_idx").on(table.workspaceId),
    // Append-only ledger, same mechanism as audit_log.
    pgPolicy("usage_events_service_select", {
      to: workspaceServiceRole,
      for: "select",
      using: sql`${table.tenantId} = ${tenantIdSetting}`,
    }),
    pgPolicy("usage_events_service_insert", {
      to: workspaceServiceRole,
      for: "insert",
      withCheck: sql`${table.tenantId} = ${tenantIdSetting}`,
    }),
  ],
);
export type DBUsageEvent = typeof usageEvents.$inferSelect;

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    tenantId: text("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    /** Optional subject workspace; plain text (no FK) so audit outlives everything. */
    workspaceId: text("workspace_id"),
    actorUserId: text("actor_user_id").notNull(),
    action: text("action").notNull(),
    detail: jsonb("detail")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("audit_log_tenant_created_idx").on(table.tenantId, table.createdAt),
    index("audit_log_workspace_id_idx").on(table.workspaceId),
    // Append-only, same mechanism as workspace_versions.
    pgPolicy("audit_log_service_select", {
      to: workspaceServiceRole,
      for: "select",
      using: sql`${table.tenantId} = ${tenantIdSetting}`,
    }),
    pgPolicy("audit_log_service_insert", {
      to: workspaceServiceRole,
      for: "insert",
      withCheck: sql`${table.tenantId} = ${tenantIdSetting}`,
    }),
  ],
);
export type DBAuditEntry = typeof auditLog.$inferSelect;

/**
 * Anonymous SDK telemetry (card #52, decision D5). Deliberately NO tenant or
 * user columns — the documented schema is aggregate-only (funnel events,
 * degradation reasons, error-code frequencies). The API key gates the
 * endpoint against abuse but is never persisted here. Append-only like the
 * audit trail; the service role may insert and read (no tenant predicate —
 * there is no tenant to scope by).
 */
export const telemetryEvents = pgTable(
  "telemetry_events",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    event: text("event").notNull(),
    props: jsonb("props")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    sdkVersion: text("sdk_version"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("telemetry_events_event_idx").on(table.event),
    index("telemetry_events_created_idx").on(table.createdAt),
    pgPolicy("telemetry_events_service_select", {
      to: workspaceServiceRole,
      for: "select",
      using: sql`true`,
    }),
    pgPolicy("telemetry_events_service_insert", {
      to: workspaceServiceRole,
      for: "insert",
      withCheck: sql`true`,
    }),
  ],
);
export type DBTelemetryEvent = typeof telemetryEvents.$inferSelect;
