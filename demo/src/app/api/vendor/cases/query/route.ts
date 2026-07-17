/**
 * The demo vendor's case backend (ADR-4 exercised). Rows live SERVER-side
 * here — not in a client bundle — and the route answers only under a valid
 * end-user session token. This is the first contract fetch in the repo whose
 * `auth` parameter is actually checked by a backend: no token, no rows.
 */
import { NextResponse } from "next/server";
import { searchCases } from "@/services/case-management";
import { verifySessionToken } from "@/services/vendor-session";

export async function POST(request: Request): Promise<NextResponse> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const userKey = token ? verifySessionToken(token) : null;
  if (!userKey) {
    return NextResponse.json(
      { message: "a valid vendor session token is required" },
      { status: 401 },
    );
  }
  // The contract's client-side engine does filter/sort/group/aggregate; the
  // vendor returns its rows under the authenticated end-user session.
  return NextResponse.json({ rows: searchCases({ limit: 240 }).cases });
}
