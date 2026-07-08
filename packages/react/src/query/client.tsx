import { useState, type ReactElement, type ReactNode } from "react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

/**
 * Build the SDK's own QueryClient. The Workspace Engine keeps an INTERNAL
 * client (Tambo's pattern): the host app may run its own React Query with its
 * own QueryClientProvider, and the two never collide because we scope our
 * queries to a client we own. Defaults are tuned for embedded dashboards, not
 * the host's preferences.
 */
export function createWorkspaceQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Per-block refresh policy drives staleness explicitly; don't second-
        // guess it with focus/reconnect refetching inside someone else's app.
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: 1,
      },
    },
  });
}

export interface WorkspaceQueryClientProviderProps {
  children: ReactNode;
  /** Supply a client to share one across renderers; defaults to an internal one. */
  client?: QueryClient | undefined;
}

/**
 * Provides the internal QueryClient to the block data hooks. WorkspaceRenderer
 * mounts this automatically when a data source is present, so consumers never
 * have to wire React Query themselves — and nesting it inside a host's own
 * QueryClientProvider is safe.
 */
export function WorkspaceQueryClientProvider({
  children,
  client,
}: WorkspaceQueryClientProviderProps): ReactElement {
  // Create-once: a fresh client per provider instance unless one is passed in.
  const [internal] = useState(() => client ?? createWorkspaceQueryClient());
  return (
    <QueryClientProvider client={client ?? internal}>
      {children}
    </QueryClientProvider>
  );
}
