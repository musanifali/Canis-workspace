/**
 * Dashboard session lifecycle (#93). Runs on the OWNER connection — a session
 * is resolved before any tenant context exists, exactly like API-key
 * resolution. The raw token is returned once (goes in an http-only cookie);
 * only its sha256 hash is stored, so a database leak can't reconstruct live
 * sessions.
 */
import { and, eq, gt } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import type { WorkspaceDb } from "../client.js";
import { sessions, users, type DBUser } from "../schema.js";

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const hashToken = (raw: string): string =>
  createHash("sha256").update(raw).digest("hex");

export interface CreatedSession {
  /** Opaque token — shown once, stored in the cookie; only its hash persists. */
  token: string;
  expiresAt: Date;
}

/** The identity a resolved session yields. */
export interface SessionUser {
  userId: string;
  tenantId: string;
  role: "owner" | "member";
  name: string | null;
  email: string | null;
}

/**
 * Mint a session for a user. Always generates a fresh token — a client can
 * never fixate a session id (the fixation defense is structural).
 * @returns The raw token (for the cookie) and its expiry.
 */
export async function createSession(
  db: WorkspaceDb,
  params: { userId: string; tenantId: string; ttlMs?: number },
): Promise<CreatedSession> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + (params.ttlMs ?? DEFAULT_TTL_MS));
  await db.insert(sessions).values({
    tokenHash: hashToken(token),
    userId: params.userId,
    tenantId: params.tenantId,
    expiresAt,
  });
  return { token, expiresAt };
}

/**
 * Resolve a session token to its user, or null if unknown/expired. Expiry is
 * enforced in the query (`expires_at > now`), so a stale token never resolves
 * even before cleanup runs.
 * @returns The session user, or null.
 */
export async function resolveSession(
  db: WorkspaceDb,
  token: string,
): Promise<SessionUser | null> {
  const [row] = await db
    .select({
      userId: users.id,
      tenantId: users.tenantId,
      role: users.role,
      name: users.name,
      email: users.email,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(token)),
        gt(sessions.expiresAt, new Date()),
      ),
    );
  return row ?? null;
}

/**
 * Delete a session (logout) — the server-side revocation. Idempotent.
 * @returns true when a session row was removed.
 */
export async function deleteSession(
  db: WorkspaceDb,
  token: string,
): Promise<boolean> {
  const removed = await db
    .delete(sessions)
    .where(eq(sessions.tokenHash, hashToken(token)))
    .returning({ tokenHash: sessions.tokenHash });
  return removed.length > 0;
}

/**
 * Revoke every session for a user (offboarding). Returns the count removed.
 */
export async function deleteUserSessions(
  db: WorkspaceDb,
  userId: string,
): Promise<number> {
  const removed = await db
    .delete(sessions)
    .where(eq(sessions.userId, userId))
    .returning({ tokenHash: sessions.tokenHash });
  return removed.length;
}

/**
 * Look up a user by their provider identity (`"github:<id>"`) — the login
 * path's resolution step.
 * @returns The user, or null if this identity has never signed up.
 */
export async function getUserByExternalId(
  db: WorkspaceDb,
  externalId: string,
): Promise<DBUser | null> {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.externalId, externalId));
  return row ?? null;
}

/**
 * List the members of a tenant, newest first (owner's member-list view).
 * Owner connection: this is admin/dashboard data, not tenant-scoped API data.
 * @returns The tenant's users.
 */
export async function listTenantMembers(
  db: WorkspaceDb,
  tenantId: string,
): Promise<DBUser[]> {
  return await db
    .select()
    .from(users)
    .where(eq(users.tenantId, tenantId))
    .orderBy(users.createdAt);
}
