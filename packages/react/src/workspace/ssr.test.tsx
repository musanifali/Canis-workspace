// @vitest-environment node
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient } from "@tanstack/react-query";
import { WorkspaceQueryClientProvider } from "../query/client";
import { WorkspaceStoreProvider } from "./context";
import type { WorkspaceStore } from "./store";
import { useWorkspaceList } from "./useWorkspaceList";

function Panel() {
  const { items, isLoading } = useWorkspaceList();
  return <div>{isLoading ? "loading" : `items:${items.length}`}</div>;
}

describe("headless hooks SSR-safety", () => {
  it("renders on the server (no window/document) without throwing", () => {
    // This file runs in the Node environment: prove there's no DOM to lean on.
    expect(typeof document).toBe("undefined");

    // A store whose list never settles: on the server the query stays pending,
    // and nothing resolves/rejects after the render, keeping the test clean.
    const store: WorkspaceStore = {
      list: () => new Promise(() => {}),
      get: () => new Promise(() => {}),
      create: () => new Promise(() => {}),
      update: () => new Promise(() => {}),
      remove: () => new Promise(() => {}),
    };

    const html = renderToStaticMarkup(
      <WorkspaceQueryClientProvider client={new QueryClient()}>
        <WorkspaceStoreProvider store={store}>
          <Panel />
        </WorkspaceStoreProvider>
      </WorkspaceQueryClientProvider>,
    );

    // On the server the query is pending → loading branch, no data access, no throw.
    expect(html).toContain("loading");
  });
});
