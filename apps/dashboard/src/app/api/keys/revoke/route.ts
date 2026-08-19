/**
 * Revoke a key (#92). Owner-gated. The confirm step lives in the UI; this just
 * performs the revocation and returns to /keys.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { revokeKey } from "@/lib/keys";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  const url = new URL("/keys", request.nextUrl.origin);
  if (!session || session.role !== "owner") {
    url.searchParams.set("error", "Owners only.");
    return NextResponse.redirect(url, { status: 303 });
  }
  const form = await request.formData();
  const id = String(form.get("id") ?? "");
  if (id) await revokeKey(id);
  return NextResponse.redirect(url, { status: 303 });
}
