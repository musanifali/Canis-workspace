/**
 * Auth gate (#93 AC: no unauthenticated dashboard page except login). Every
 * request outside the public set must carry a session cookie that resolves to
 * a live server-side session; otherwise it's redirected to /login. A forged or
 * expired cookie fails resolution the same as no cookie — the service is the
 * source of truth, so this can't be spoofed from the browser.
 */
import { NextResponse, type NextRequest } from "next/server";
import { resolveToken, SESSION_COOKIE } from "@/lib/session";

// Public pages (API routes are excluded from the matcher and self-gate).
// /signup and /welcome must stay open so a new user can get a session.
const PUBLIC_PREFIXES = ["/login", "/signup", "/welcome"];

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const user = token ? await resolveToken(token) : null;
  if (!user) {
    const url = new URL("/login", request.nextUrl.origin);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Pages only: skip Next internals, static assets, and /api (routes self-gate
  // and must return their own status, not a login redirect).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
