/**
 * The Phase 4 port swap, held by the type system: the HTTP store must satisfy
 * the SDK's WorkspaceStore port EXACTLY as the SDK declares it (the interface
 * Phases 2/3 were built against — see the kickoff's "don't change the port"
 * constraint). If either side drifts, this file stops compiling.
 */
import type { WorkspaceStore } from "@workspace-engine/react";
import { describe, expect, it } from "vitest";
import { createHttpWorkspaceStore } from "./http-store.js";

describe("createHttpWorkspaceStore", () => {
  it("satisfies the SDK's WorkspaceStore port", () => {
    const store: WorkspaceStore = createHttpWorkspaceStore({
      baseUrl: "http://localhost:8270",
      apiKey: "wek_test",
      userId: "user_test",
    });
    expect(typeof store.list).toBe("function");
    expect(typeof store.get).toBe("function");
    expect(typeof store.create).toBe("function");
    expect(typeof store.update).toBe("function");
    expect(typeof store.remove).toBe("function");
  });

  it("strips trailing slashes from the base url", async () => {
    const seen: string[] = [];
    const fakeFetch: typeof fetch = async (input) => {
      seen.push(String(input));
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const store = createHttpWorkspaceStore({
      baseUrl: "http://localhost:8270///",
      apiKey: "wek_test",
      userId: "user_test",
      fetch: fakeFetch,
    });
    await store.list();
    expect(seen).toEqual(["http://localhost:8270/v1/workspaces"]);
  });
});
