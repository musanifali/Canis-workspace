/**
 * Server-to-server call to the Workspace Service's /v1/signup (#91). Carries
 * the shared provisioning secret so the service trusts this BFF; the GitHub
 * identity was already verified upstream.
 */
import type { GitHubIdentity } from "@/lib/github-oauth";

export interface ProvisionResult {
  tenantId: string;
  slug: string;
  orgName: string;
  userId: string;
  /** Raw admin key — present only on first provision; null on replay. */
  apiKey: string | null;
  created: boolean;
}

export type ProvisionOutcome =
  | { ok: true; result: ProvisionResult }
  | { ok: false; status: number; code?: string; message: string };

/**
 * Provision (or idempotently resolve) a tenant for a verified GitHub identity.
 * @returns A discriminated outcome so the caller can map slug conflicts etc.
 *   back to the form without throwing.
 */
export async function provisionTenant(
  identity: GitHubIdentity,
  org: { orgName: string; slug: string },
): Promise<ProvisionOutcome> {
  const baseUrl = process.env.WORKSPACE_API_URL ?? "http://localhost:8270";
  const secret = process.env.WORKSPACE_PROVISION_SECRET;
  if (!secret) {
    return {
      ok: false,
      status: 503,
      message:
        "WORKSPACE_PROVISION_SECRET is not set on the dashboard — signup " +
        "cannot reach the service.",
    };
  }

  const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/v1/signup`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-provision-secret": secret,
    },
    cache: "no-store",
    body: JSON.stringify({
      orgName: org.orgName,
      slug: org.slug,
      owner: {
        externalId: identity.externalId,
        email: identity.email,
        name: identity.name,
      },
    }),
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      code: typeof data.code === "string" ? data.code : undefined,
      message:
        typeof data.message === "string" ? data.message : `signup failed (${res.status})`,
    };
  }
  return { ok: true, result: data as unknown as ProvisionResult };
}
