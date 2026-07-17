/**
 * Vendor session mint (ADR-4). The demo client exchanges its end-user key
 * for a signed session token; the case-query route only answers requests
 * carrying one. Signing happens here, server-side — the secret never
 * reaches the browser.
 */
import { NextResponse } from "next/server";
import { mintSessionToken } from "@/services/vendor-session";

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => null)) as {
    userKey?: string;
  } | null;
  const userKey = body?.userKey;
  if (!userKey || typeof userKey !== "string" || userKey.length > 200) {
    return NextResponse.json(
      { message: "userKey (string) is required" },
      { status: 400 },
    );
  }
  return NextResponse.json({ token: mintSessionToken(userKey) });
}
