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
 * Tenant scoping for RLS policies. `current_setting` with no missing_ok is
 * deliberate: a tenant-scoped query outside `withTenant` fails loudly instead
 * of silently returning nothing.
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
    workspaceId: text("workspace_id")
      .references(() => workspaces.id)
      .notNull(),
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
    workspaceId: text("workspace_id")
      .references(() => workspaces.id)
      .notNull(),
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
