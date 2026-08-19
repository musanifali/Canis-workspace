/**
 * Clears the single-use minted-key cookie (#92) once the owner has copied it —
 * the "shown exactly once" guarantee for the /keys reveal banner.
 */
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const res = NextResponse.redirect(new URL("/keys", request.nextUrl.origin), {
    status: 303,
  });
  res.cookies.delete("minted_key");
  return res;
}
