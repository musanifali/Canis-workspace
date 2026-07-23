/**
 * GitHub OAuth (authorization-code flow), server-side only (#91). The client
 * secret and the Workspace Service provisioning secret never reach the
 * browser; the dashboard is the BFF that verifies the GitHub identity and then
 * calls /v1/signup server-to-server.
 *
 * Real credentials (GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET) come from a GitHub
 * OAuth app the founder registers — until then these routes 503 with a clear
 * message rather than pretending to work.
 */
const GITHUB_AUTHORIZE = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN = "https://github.com/login/oauth/access_token";
const GITHUB_API_USER = "https://api.github.com/user";
const GITHUB_API_EMAILS = "https://api.github.com/user/emails";

export interface GitHubConfig {
  clientId: string;
  clientSecret: string;
  /** Absolute callback URL registered with the OAuth app. */
  callbackUrl: string;
}

/**
 * Resolve GitHub OAuth config from env, or null when unconfigured (the routes
 * turn null into a 503 so a missing app is obvious, not a silent failure).
 * @returns The config, or null if either credential is unset.
 */
export function githubConfig(): GitHubConfig | null {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const base = process.env.DASHBOARD_BASE_URL ?? "http://localhost:3002";
  return {
    clientId,
    clientSecret,
    callbackUrl: `${base.replace(/\/+$/, "")}/api/auth/github/callback`,
  };
}

/** Build the GitHub authorize URL for a given CSRF state token. */
export function authorizeUrl(config: GitHubConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.callbackUrl,
    scope: "read:user user:email",
    state,
    allow_signup: "true",
  });
  return `${GITHUB_AUTHORIZE}?${params.toString()}`;
}

/**
 * Exchange an authorization code for an access token.
 * @returns The access token.
 * @throws Error when GitHub rejects the exchange.
 */
export async function exchangeCode(
  config: GitHubConfig,
  code: string,
): Promise<string> {
  const res = await fetch(GITHUB_TOKEN, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.callbackUrl,
    }),
  });
  const data = (await res.json()) as { access_token?: string; error?: string };
  if (!data.access_token) {
    throw new Error(`GitHub token exchange failed: ${data.error ?? "no token"}`);
  }
  return data.access_token;
}

export interface GitHubIdentity {
  /** Stable numeric id — survives handle renames. Becomes `github:<id>`. */
  externalId: string;
  login: string;
  name: string | null;
  email: string | null;
}

/**
 * Fetch the authenticated user's identity, resolving a primary verified email
 * even when the profile email is private.
 * @returns The normalized identity used for provisioning.
 */
export async function fetchIdentity(token: string): Promise<GitHubIdentity> {
  const headers = {
    authorization: `Bearer ${token}`,
    accept: "application/vnd.github+json",
    "user-agent": "canis-dashboard",
  };
  const userRes = await fetch(GITHUB_API_USER, { headers });
  if (!userRes.ok) {
    throw new Error(`GitHub /user failed: ${userRes.status}`);
  }
  const user = (await userRes.json()) as {
    id: number;
    login: string;
    name: string | null;
    email: string | null;
  };

  let email = user.email;
  if (!email) {
    const emailRes = await fetch(GITHUB_API_EMAILS, { headers });
    if (emailRes.ok) {
      const emails = (await emailRes.json()) as {
        email: string;
        primary: boolean;
        verified: boolean;
      }[];
      email =
        emails.find((e) => e.primary && e.verified)?.email ??
        emails.find((e) => e.verified)?.email ??
        null;
    }
  }

  return {
    externalId: `github:${user.id}`,
    login: user.login,
    name: user.name,
    email,
  };
}
