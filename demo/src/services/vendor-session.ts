/**
 * The demo vendor's end-user session tokens (ADR-4, Phase 4).
 *
 * The vendor backend (this Next server) mints an HMAC-signed token binding
 * the end user's identity; every case query must present it, and the query
 * route rejects requests without a valid one. This is what turns ADR-4's
 * auth-passthrough from "an enforced interface" into "an exercised one":
 * `fetch(query, auth)` now carries auth that a real backend actually checks.
 *
 * Demo-grade on purpose: the end-user identity is the demo's anonymous key
 * and the secret defaults for local dev. The mechanism (server-side mint +
 * server-side verify + 401 without) is the real thing.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const PREFIX = "wes_v1";

const secretOf = (): string =>
  process.env.DEMO_VENDOR_SESSION_SECRET ?? "demo-vendor-secret-dev-only";

const sign = (userKey: string, secret: string): string =>
  createHmac("sha256", secret).update(`${PREFIX}.${userKey}`).digest("base64url");

/**
 * Mint a session token for an end user (server-side only).
 * @returns The token: `wes_v1.<userKey>.<signature>`.
 */
export function mintSessionToken(
  userKey: string,
  secret = secretOf(),
): string {
  return `${PREFIX}.${userKey}.${sign(userKey, secret)}`;
}

/**
 * Verify a presented token.
 * @returns The authenticated userKey, or null when the token is invalid.
 */
export function verifySessionToken(
  token: string,
  secret = secretOf(),
): string | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== PREFIX) {
    return null;
  }
  const userKey = parts[1];
  const presented = parts[2];
  if (!userKey || !presented) {
    return null;
  }
  const expected = Buffer.from(sign(userKey, secret));
  const actual = Buffer.from(presented);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }
  return userKey;
}
