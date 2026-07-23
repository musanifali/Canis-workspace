/**
 * Clears the one-time signup handoff cookie and returns to the dashboard
 * (#91). Keeping the raw-key cookie single-use is the "shown exactly once"
 * guarantee for the welcome screen.
 */
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const res = NextResponse.redirect(new URL("/", request.nextUrl.origin), {
    status: 303,
  });
  res.cookies.delete("signup_result");
  return res;
}
