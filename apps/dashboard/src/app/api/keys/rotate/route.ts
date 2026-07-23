/**
 * Rotate a key (#92): the guided mint-then-revoke flow. Mints a replacement
 * (same scope), and only if that succeeds revokes the old one — so a failed
 * rotation never leaves the tenant with no working key. The new raw key is
 * shown once via the same single-use cookie as mint.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { mintKey, revokeKey } from "@/lib/keys";
import { seal } from "@/lib/oauth-state";

function back(request: NextRequest, params: Record<string, string> = {}) {
  const url = new URL("/keys", request.nextUrl.origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session || session.role !== "owner") return back(request, { error: "Owners only." });

  const form = await request.formData();
  const oldId = String(form.get("id") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const scope = String(form.get("scope") ?? "");
  if (!oldId || !name || (scope !== "runtime" && scope !== "admin")) {
    return back(request, { error: "Missing rotation details." });
  }

  // Mint the replacement first; only revoke the old key if that succeeded.
  const minted = await mintKey(`${name} (rotated)`, scope);
  if (!minted.ok) return back(request, { error: minted.message });
  await revokeKey(oldId);

  const res = back(request);
  res.cookies.set(
    "minted_key",
    seal({ rawKey: minted.rawKey, name: minted.name, scope: minted.scope, rotated: "1" }),
    { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 300 },
  );
  return res;
}
