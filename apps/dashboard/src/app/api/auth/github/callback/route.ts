/**
 * Shared GitHub OAuth callback (#91 signup + #93 login). GitHub allows one
 * registered callback URL, so both flows land here and branch on which signed
 * state cookie is present: `login_state` → login (resolve an existing user into
 * a session); otherwise the signup flow (provision a tenant).
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  exchangeCode,
  fetchIdentity,
  githubConfig,
  type GitHubConfig,
} from "@/lib/github-oauth";
import { seal, unseal } from "@/lib/oauth-state";
import { provisionTenant } from "@/lib/provision";
import { loginToService, SESSION_COOKIE } from "@/lib/session";

function toSignup(req: NextRequest, error: string, org?: Record<string, string>) {
  const url = new URL("/signup", req.nextUrl.origin);
  url.searchParams.set("error", error);
  if (org?.orgName) url.searchParams.set("org", org.orgName);
  if (org?.slug) url.searchParams.set("slug", org.slug);
  return NextResponse.redirect(url, { status: 303 });
}

function toLogin(req: NextRequest, error: string) {
  const url = new URL("/login", req.nextUrl.origin);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url, { status: 303 });
}

/** Login branch: resolve the verified identity into a server-side session. */
async function handleLogin(
  request: NextRequest,
  config: GitHubConfig,
): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const returnedState = params.get("state");
  const savedState = unseal(request.cookies.get("login_state")?.value)?.state;

  if (params.get("error")) return toLogin(request, "csrf");
  if (!code || !returnedState || !savedState || returnedState !== savedState) {
    return toLogin(request, "csrf");
  }

  let identity;
  try {
    const token = await exchangeCode(config, code);
    identity = await fetchIdentity(token);
  } catch {
    return toLogin(request, "github");
  }

  const outcome = await loginToService(identity.externalId);
  if (!outcome.ok) {
    return toLogin(request, outcome.code === "user_not_found" ? "user_not_found" : "github");
  }

  // This dashboard serves one tenant; only its members may log in (otherwise a
  // user from another tenant would act under this dashboard's tenant key).
  const boundTenant = process.env.WORKSPACE_TENANT_ID;
  if (boundTenant && outcome.user.tenantId !== boundTenant) {
    return toLogin(request, "not_a_member");
  }

  const res = NextResponse.redirect(new URL("/", request.nextUrl.origin), { status: 303 });
  res.cookies.set(SESSION_COOKIE, outcome.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(outcome.expiresAt),
  });
  res.cookies.delete("login_state");
  return res;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const config = githubConfig();
  if (!config) {
    return toSignup(request, "GitHub sign-in isn’t configured.");
  }

  // Login and signup share this callback; the state cookie says which.
  if (request.cookies.get("login_state")) {
    return handleLogin(request, config);
  }

  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const returnedState = params.get("state");
  const savedState = unseal(request.cookies.get("oauth_state")?.value)?.state;
  const org = unseal(request.cookies.get("signup_org")?.value) ?? undefined;

  if (params.get("error")) {
    return toSignup(request, "GitHub sign-in was cancelled.", org);
  }
  if (!code || !returnedState || !savedState || returnedState !== savedState) {
    return toSignup(request, "Sign-in expired or was tampered with. Try again.", org);
  }
  if (!org?.orgName || !org?.slug) {
    return toSignup(request, "Your signup details expired. Try again.");
  }

  let identity;
  try {
    const token = await exchangeCode(config, code);
    identity = await fetchIdentity(token);
  } catch {
    return toSignup(request, "Couldn’t verify your GitHub account. Try again.", org);
  }

  const outcome = await provisionTenant(identity, {
    orgName: org.orgName,
    slug: org.slug,
  });
  if (!outcome.ok) {
    const msg =
      outcome.code === "tenant_slug_taken"
        ? `The handle “${org.slug}” is taken — pick another.`
        : outcome.message;
    return toSignup(request, msg, org);
  }

  const res = NextResponse.redirect(new URL("/welcome", request.nextUrl.origin), {
    status: 303,
  });
  // Single-use handoff of the raw key (shown once). Cleared by /welcome.
  res.cookies.set(
    "signup_result",
    seal({
      orgName: outcome.result.orgName,
      slug: outcome.result.slug,
      tenantId: outcome.result.tenantId,
      apiKey: outcome.result.apiKey ?? "",
      created: String(outcome.result.created),
    }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    },
  );
  res.cookies.delete("oauth_state");
  res.cookies.delete("signup_org");
  return res;
}
