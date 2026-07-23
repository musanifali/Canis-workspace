/**
 * Dashboard session helpers (#93). The session lives server-side in the
 * Workspace Service; the browser holds only an opaque token in an http-only
 * cookie. Every check here re-validates against the service, so logout (which
 * deletes the server-side row) takes effect immediately.
 */
import { cookies } from "next/headers";

export const SESSION_COOKIE = "dash_session";

export interface SessionUser {
  userId: string;
  tenantId: string;
  role: "owner" | "member";
  name: string | null;
  email: string | null;
}

function apiBase(): string {
  return (process.env.WORKSPACE_API_URL ?? "http://localhost:8270").replace(/\/+$/, "");
}

/** Read the raw session token from the cookie jar, if present. */
export async function sessionToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}

/**
 * Resolve the current session against the service, or null if absent/invalid.
 * Server-side revocation means a logged-out token returns null here even
 * though the cookie still exists in the browser.
 */
export async function getSession(): Promise<SessionUser | null> {
  const token = await sessionToken();
  if (!token) return null;
  return resolveToken(token);
}

/** Resolve an explicit token (used by middleware, which reads the raw cookie). */
export async function resolveToken(token: string): Promise<SessionUser | null> {
  const res = await fetch(`${apiBase()}/v1/auth/session`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as SessionUser;
}

export type LoginOutcome =
  | { ok: true; token: string; expiresAt: string; user: SessionUser }
  | { ok: false; status: number; code?: string; message: string };

/**
 * Exchange a verified external identity for a session (BFF → service, with the
 * provisioning secret). 404 means the identity has no account yet.
 */
export async function loginToService(externalId: string): Promise<LoginOutcome> {
  const secret = process.env.WORKSPACE_PROVISION_SECRET;
  if (!secret) {
    return { ok: false, status: 503, message: "WORKSPACE_PROVISION_SECRET unset on the dashboard" };
  }
  const res = await fetch(`${apiBase()}/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-provision-secret": secret },
    cache: "no-store",
    body: JSON.stringify({ externalId }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      code: typeof data.code === "string" ? data.code : undefined,
      message: typeof data.message === "string" ? data.message : `login failed (${res.status})`,
    };
  }
  return { ok: true, ...(data as { token: string; expiresAt: string; user: SessionUser }) };
}

export interface Member {
  id: string;
  name: string | null;
  email: string | null;
  role: "owner" | "member";
  createdAt: string;
}

/**
 * Fetch the tenant's member list for the current session (owner-only on the
 * service; returns null for non-owners or on error).
 */
export async function listMembers(): Promise<Member[] | null> {
  const token = await sessionToken();
  if (!token) return null;
  const res = await fetch(`${apiBase()}/v1/auth/members`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as Member[];
}

/** Revoke a session server-side (logout). Best-effort. */
export async function logoutFromService(token: string): Promise<void> {
  await fetch(`${apiBase()}/v1/auth/logout`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  }).catch(() => undefined);
}
