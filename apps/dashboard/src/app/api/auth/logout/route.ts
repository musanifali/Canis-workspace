/**
 * Logout (#93): revoke the session server-side (delete the row) and clear the
 * cookie. POST-only + SameSite=Lax cookies means a cross-site page can't force
 * a logout. Idempotent.
 */
import { NextResponse, type NextRequest } from "next/server";
import { logoutFromService, SESSION_COOKIE } from "@/lib/session";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) await logoutFromService(token);
  const res = NextResponse.redirect(new URL("/login", request.nextUrl.origin), {
    status: 303,
  });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
