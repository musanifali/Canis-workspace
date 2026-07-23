/**
 * Login OAuth start (#93). Sets a signed CSRF state cookie and redirects to
 * GitHub. Distinct from the signup start (/api/auth/github/start) — this one
 * carries no org form; the callback resolves an EXISTING user into a session.
 */
import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { authorizeUrl, githubConfig } from "@/lib/github-oauth";
import { seal } from "@/lib/oauth-state";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const config = githubConfig();
  if (!config) {
    return NextResponse.redirect(new URL("/login?error=not_configured", request.nextUrl.origin), {
      status: 303,
    });
  }
  const state = randomBytes(16).toString("base64url");
  const res = NextResponse.redirect(authorizeUrl(config, state), { status: 303 });
  res.cookies.set("login_state", seal({ state }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
