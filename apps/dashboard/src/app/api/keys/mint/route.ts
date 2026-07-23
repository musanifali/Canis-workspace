/**
 * Mint a key (#92). Owner-gated; the raw key rides a single-use signed cookie
 * to /keys, which shows it exactly once. Server-to-server via the admin key.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { mintKey } from "@/lib/keys";
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
  const name = String(form.get("name") ?? "").trim();
  const scope = String(form.get("scope") ?? "");
  if (!name || (scope !== "runtime" && scope !== "admin")) {
    return back(request, { error: "Give the key a name and a valid scope." });
  }

  const outcome = await mintKey(name, scope);
  if (!outcome.ok) return back(request, { error: outcome.message });

  const res = back(request);
  res.cookies.set(
    "minted_key",
    seal({ rawKey: outcome.rawKey, name: outcome.name, scope: outcome.scope }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 300,
    },
  );
  return res;
}
