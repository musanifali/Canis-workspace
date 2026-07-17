/**
 * ADR-4, exercised (Phase 4): the vendor backend actually checks the
 * end-user credential that WorkspaceProvider threads through `fetch(query,
 * auth)`. These tests drive the REAL route handlers and the REAL remote
 * contract — no token, no rows.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as mintSession } from "@/app/api/vendor/session/route";
import { POST as queryCases } from "@/app/api/vendor/cases/query/route";
import {
  mintSessionToken,
  verifySessionToken,
} from "@/services/vendor-session";
import { createRemoteCaseContract } from "./case-contract";
import {
  createDemoWorkspaceStore,
  createLocalStorageWorkspaceStore,
} from "./workspace-store";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("vendor session tokens", () => {
  it("mint → verify round-trips the user key", () => {
    const token = mintSessionToken("anon-1234");
    expect(verifySessionToken(token)).toBe("anon-1234");
  });

  it("a tampered token verifies to null", () => {
    const token = mintSessionToken("anon-1234");
    expect(verifySessionToken(token.replace("anon-1234", "anon-9999"))).toBeNull();
    expect(verifySessionToken("wes_v1.anon-1234.forged")).toBeNull();
    expect(verifySessionToken("garbage")).toBeNull();
  });
});

describe("the vendor case backend requires the end-user session", () => {
  const query = (authorization?: string) =>
    queryCases(
      new Request("http://demo.local/api/vendor/cases/query", {
        method: "POST",
        headers: authorization ? { authorization } : {},
        body: "{}",
      }),
    );

  it("401s without a token — auth is checked, not merely threaded", async () => {
    const response = await query();
    expect(response.status).toBe(401);
  });

  it("401s for a forged token", async () => {
    const response = await query("Bearer wes_v1.anon-1234.forged");
    expect(response.status).toBe(401);
  });

  it("returns the vendor's rows under a minted session", async () => {
    const minted = await mintSession(
      new Request("http://demo.local/api/vendor/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userKey: "anon-e2e" }),
      }),
    );
    expect(minted.status).toBe(200);
    const { token } = (await minted.json()) as { token: string };

    const response = await query(`Bearer ${token}`);
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { rows: unknown[] };
    expect(payload.rows.length).toBeGreaterThan(100);
  });
});

describe("the remote contract passes auth through UNCHANGED (ADR-4)", () => {
  it("presents WorkspaceProvider's userToken as the Bearer credential", async () => {
    const seen: { url: string; auth: string | null }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      const headers = new Headers(init.headers);
      seen.push({ url: String(url), auth: headers.get("authorization") });
      return new Response(JSON.stringify({ rows: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const contract = createRemoteCaseContract("http://vendor.local");
    await contract.fetch({
      query: { filters: [], sort: [] },
      auth: "wes_v1.anon-1234.sig",
    });
    expect(seen).toEqual([
      {
        url: "http://vendor.local/api/vendor/cases/query",
        auth: "Bearer wes_v1.anon-1234.sig",
      },
    ]);
  });

  it("refuses to produce rows when the backend says 401", async () => {
    vi.stubGlobal(
      "fetch",
      async () => new Response("{}", { status: 401 }),
    );
    const contract = createRemoteCaseContract("http://vendor.local");
    await expect(
      contract.fetch({ query: { filters: [], sort: [] }, auth: null }),
    ).rejects.toThrow(/401/);
  });
});

describe("the store port swap", () => {
  it("uses the HTTP-backed store in service mode (same port, real backend)", async () => {
    const seen: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      seen.push(String(url));
      return new Response("[]", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const store = createDemoWorkspaceStore("anon-1234", {
      baseUrl: "http://service.local",
      apiKey: "wek_demo",
    });
    await store.list();
    expect(seen).toEqual(["http://service.local/v1/workspaces"]);
  });

  it("falls back to localStorage outside service mode", async () => {
    const store = createDemoWorkspaceStore("anon-1234", null);
    // Same behavior class as the original local store: empty list, no network.
    expect(await store.list()).toEqual([]);
    expect((await createLocalStorageWorkspaceStore().list())).toEqual([]);
  });
});
