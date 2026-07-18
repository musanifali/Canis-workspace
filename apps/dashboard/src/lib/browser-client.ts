/**
 * The browser-side SDK wiring — public surface only (#53): the typed client
 * and the WorkspaceStore port implementation, pointed at the same-origin
 * proxy. The apiKey value is a placeholder; the proxy injects the real one
 * server-side and pins the acting user.
 */
import {
  createHttpWorkspaceStore,
  createWorkspaceServiceClient,
} from "@workspace-engine/client";

const options = {
  baseUrl: "/api/canis",
  apiKey: "injected-by-proxy",
  userId: "canis_ops",
};

export const canisClient = createWorkspaceServiceClient(options);
export const canisStore = createHttpWorkspaceStore(options);
