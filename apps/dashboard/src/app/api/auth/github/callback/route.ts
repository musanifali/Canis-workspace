/**
 * OAuth callback (#91): verify the CSRF state, exchange the code, fetch the
 * verified GitHub identity, provision the tenant via the service, then hand the
 * one-time admin key to the welcome screen through a single-use signed cookie.
 *
 * There is no login session here yet — that's #93. This route's job ends at
 * "the tenant exists and the user has their key".
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  exchangeCode,
  fetchIdentity,
  githubConfig,
} from "@/lib/github-oauth";
import { seal, unseal } from "@/lib/oauth-state";
import { provisionTenant } from "@/lib/provision";

function toSignup(req: NextRequest, error: string, org?: Record<string, string>) {
  const url = new URL("/signup", req.nextUrl.origin);
  url.searchParams.set("error", error);
  if (org?.orgName) url.searchParams.set("org", org.orgName);
  if (org?.slug) url.searchParams.set("slug", org.slug);
  return NextResponse.redirect(url, { status: 303 });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const config = githubConfig();
  if (!config) {
    return toSignup(request, "GitHub sign-in isn’t configured.");
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
