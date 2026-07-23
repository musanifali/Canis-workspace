/**
 * Server-side helpers for the key-management UI (#92). All calls use the
 * dashboard's admin key (server env, never the browser) and the acting user
 * from the session. Mint/revoke are owner-gated by the route handlers before
 * these run.
 */
import { getSession } from "@/lib/session";

export interface ApiKey {
  id: string;
  name: string;
  scope: "runtime" | "admin";
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

function apiBase(): string {
  return (process.env.WORKSPACE_API_URL ?? "http://localhost:8270").replace(/\/+$/, "");
}

async function authHeaders(): Promise<Record<string, string> | null> {
  const apiKey = process.env.WORKSPACE_API_KEY;
  const session = await getSession();
  if (!apiKey || !session) return null;
  return { "x-api-key": apiKey, "x-user-id": session.userId };
}

/** List the tenant's keys (metadata only). Null if unauthenticated/misconfigured. */
export async function listKeys(): Promise<ApiKey[] | null> {
  const headers = await authHeaders();
  if (!headers) return null;
  const res = await fetch(`${apiBase()}/v1/keys`, { headers, cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as ApiKey[];
}

export type MintOutcome =
  | { ok: true; rawKey: string; name: string; scope: string }
  | { ok: false; message: string };

/** Mint a key; the raw value comes back exactly once. */
export async function mintKey(name: string, scope: "runtime" | "admin"): Promise<MintOutcome> {
  const headers = await authHeaders();
  if (!headers) return { ok: false, message: "not authenticated" };
  const res = await fetch(`${apiBase()}/v1/keys`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ name, scope }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string };
    return { ok: false, message: data.message ?? `mint failed (${res.status})` };
  }
  const key = (await res.json()) as { rawKey: string; name: string; scope: string };
  return { ok: true, rawKey: key.rawKey, name: key.name, scope: key.scope };
}

/** Revoke a key by id. */
export async function revokeKey(id: string): Promise<boolean> {
  const headers = await authHeaders();
  if (!headers) return false;
  const res = await fetch(`${apiBase()}/v1/keys/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers,
    cache: "no-store",
  });
  return res.status === 204;
}
