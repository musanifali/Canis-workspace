/**
 * OAuth start (#91): validate the org form, stash it + a CSRF state token in
 * signed, http-only cookies, and redirect to GitHub. No session store yet
 * (#93) — the signed cookies carry everything the callback needs.
 */
import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { authorizeUrl, githubConfig } from "@/lib/github-oauth";
import { seal } from "@/lib/oauth-state";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function backToForm(req: NextRequest, error: string, org: string, slug: string) {
  const url = new URL("/signup", req.nextUrl.origin);
  url.searchParams.set("error", error);
  if (org) url.searchParams.set("org", org);
  if (slug) url.searchParams.set("slug", slug);
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const form = await request.formData();
  const orgName = String(form.get("orgName") ?? "").trim();
  const slug = String(form.get("slug") ?? "").trim().toLowerCase();

  if (!orgName || orgName.length > 80) {
    return backToForm(request, "Enter an organization name.", orgName, slug);
  }
  if (slug.length < 3 || slug.length > 40 || !SLUG_RE.test(slug)) {
    return backToForm(
      request,
      "Handle must be 3–40 lowercase letters, numbers, and single hyphens.",
      orgName,
      slug,
    );
  }

  const config = githubConfig();
  if (!config) {
    return backToForm(
      request,
      "GitHub sign-in isn’t configured yet (GITHUB_CLIENT_ID/SECRET unset).",
      orgName,
      slug,
    );
  }

  const state = randomBytes(16).toString("base64url");
  const res = NextResponse.redirect(authorizeUrl(config, state), { status: 303 });
  const cookie = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600, // 10 minutes to complete the round-trip
  };
  res.cookies.set("oauth_state", seal({ state }), cookie);
  res.cookies.set("signup_org", seal({ orgName, slug }), cookie);
  return res;
}
