/**
 * Short-lived signed cookies that carry state across the GitHub OAuth
 * round-trip (#91) — there's no session store yet (that's #93). Two things
 * survive the redirect: a CSRF `state` token, and the org form the user filled
 * in before authorizing. Both are HMAC-signed with the provisioning secret so
 * the callback can trust them.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const SECRET = () =>
  process.env.WORKSPACE_PROVISION_SECRET ?? "dev-unsigned-oauth-secret";

function sign(payload: string): string {
  return createHmac("sha256", SECRET()).update(payload).digest("base64url");
}

/** Encode `data` as `base64url(json).signature`. */
export function seal(data: Record<string, string>): string {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/**
 * Verify and decode a sealed cookie value.
 * @returns The decoded object, or null if missing/tampered.
 */
export function unseal(value: string | undefined): Record<string, string> | null {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}
