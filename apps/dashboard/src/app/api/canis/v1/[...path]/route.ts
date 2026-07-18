/**
 * GET-only proxy to the Workspace Service. The tenant API key lives in server
 * env and is injected here — it never ships to the browser (unlike the demo's
 * NEXT_PUBLIC_ pattern; see PAPERCUTS.md #1). The acting user is pinned
 * server-side too: dashboard viewers cannot impersonate via headers. Writes
 * are not proxied — saving views is the seed's job, through the public API.
 */
import { NextResponse, type NextRequest } from "next/server";

const PROXIED_ROOTS = new Set(["workspaces", "audit", "contracts", "usage"]);

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await context.params;
  const root = path[0];
  if (!root || !PROXIED_ROOTS.has(root)) {
    return NextResponse.json({ message: "not proxied" }, { status: 404 });
  }
  const apiKey = process.env.WORKSPACE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        message:
          "WORKSPACE_API_KEY is not set — provision with " +
          "scripts/seed-dashboard-tenant.mjs and fill .env.local",
      },
      { status: 503 },
    );
  }
  const baseUrl = process.env.WORKSPACE_API_URL ?? "http://localhost:8270";
  const url = new URL(
    `${baseUrl.replace(/\/+$/, "")}/v1/${path.map(encodeURIComponent).join("/")}`,
  );
  request.nextUrl.searchParams.forEach((value, key) =>
    url.searchParams.set(key, value),
  );
  const upstream = await fetch(url, {
    headers: {
      "x-api-key": apiKey,
      "x-user-id": process.env.WORKSPACE_DASHBOARD_USER ?? "canis_ops",
    },
    cache: "no-store",
  });
  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      "content-type":
        upstream.headers.get("content-type") ?? "application/json",
    },
  });
}
