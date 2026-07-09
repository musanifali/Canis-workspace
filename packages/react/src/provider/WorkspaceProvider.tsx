import { useEffect, useMemo, useRef, type ReactElement, type ReactNode } from "react";
import type { QueryClient } from "@tanstack/react-query";
import {
  DEFAULT_REGISTRY,
  type BlockRegistry,
  type EntityContract,
  type TenantPolicy,
  type ValidationContext,
} from "@workspace-engine/core";
import { WorkspaceQueryClientProvider } from "../query/client";
import { WorkspaceStoreProvider } from "../workspace/context";
import { createInMemoryWorkspaceStore, type WorkspaceStore } from "../workspace/store";
import type { OnBlockDegraded } from "../renderer/degradation";
import { buildBlockRegistry, type BlockDefinition } from "./defineBlock";
import { WorkspaceConfigContext, type WorkspaceConfig } from "./config-context";

export interface WorkspaceProviderProps {
  /** Platform API key for the Workspace Service (used from Phase 4). Optional in devMode. */
  apiKey?: string | undefined;
  /** End-user auth, passed UNCHANGED to every contract's vendor fetch (ADR-4). */
  userToken?: unknown;
  /** Entity contracts (defineEntity); indexed by name for bindings + validation. */
  contracts?: readonly EntityContract[] | undefined;
  /** Registered blocks (defineBlock); validated against the registry here. */
  blocks?: readonly BlockDefinition[] | undefined;
  /**
   * Developer sandbox mode: makes apiKey/userToken/contracts/blocks optional and
   * prints a next-step banner to the console. Pair with @workspace-engine/ui's
   * WorkspaceSandbox (or defaultBlocks + a bundled sample contract) to get a live
   * screen before writing a single contract.
   */
  devMode?: boolean | undefined;
  /** Persistence for saved workspaces; defaults to an in-memory store. */
  store?: WorkspaceStore | undefined;
  /** Block registry override; defaults to the v1 DEFAULT_REGISTRY. */
  registry?: BlockRegistry | undefined;
  /** Tenant policy (allowed block types/entities, block cap). */
  policy?: TenantPolicy | undefined;
  /** Share an existing QueryClient; defaults to an internal one. */
  queryClient?: QueryClient | undefined;
  /** Telemetry: fires once whenever any block renders in a degraded state. */
  onBlockDegraded?: OnBlockDegraded | undefined;
  children: ReactNode;
}

/**
 * The 3-step integration surface: contracts + blocks + provider. Composes the
 * internal React Query client (#14), the persistence store + validation context
 * (#15), and the block/data config the renderer reads — so a vendor mounts this
 * once and then renders any workspace with `<WorkspaceRenderer spec={…} />`,
 * no per-render wiring. Block registration is validated here: a bad `accepts`
 * declaration throws a BlockRegistrationError at mount, not silently at runtime.
 */
export function WorkspaceProvider({
  apiKey,
  userToken = null,
  contracts = [],
  blocks = [],
  store,
  registry,
  policy,
  queryClient,
  onBlockDegraded,
  devMode = false,
  children,
}: WorkspaceProviderProps): ReactElement {
  const resolvedRegistry = registry ?? DEFAULT_REGISTRY;
  const resolvedApiKey = apiKey ?? (devMode ? "dev-mode" : "");

  useDevModeBanner(devMode);

  const contractsByName = useMemo(
    () => Object.fromEntries(contracts.map((c) => [c.name, c])),
    [contracts],
  );

  const components = useMemo(
    () => buildBlockRegistry(blocks, { registry: resolvedRegistry, contracts: contractsByName }),
    [blocks, resolvedRegistry, contractsByName],
  );

  const validation = useMemo<ValidationContext>(
    () => ({
      contracts: contractsByName,
      registry: resolvedRegistry,
      ...(policy ? { policy } : {}),
    }),
    [contractsByName, resolvedRegistry, policy],
  );

  const resolvedStore = useMemo(
    () => store ?? createInMemoryWorkspaceStore(),
    [store],
  );

  const config = useMemo<WorkspaceConfig>(
    () => ({
      components,
      dataSource: { contracts: contractsByName, auth: userToken },
      validation,
      apiKey: resolvedApiKey,
      ...(onBlockDegraded ? { onBlockDegraded } : {}),
    }),
    [components, contractsByName, userToken, validation, resolvedApiKey, onBlockDegraded],
  );

  return (
    <WorkspaceQueryClientProvider client={queryClient}>
      <WorkspaceStoreProvider store={resolvedStore} validation={validation}>
        <WorkspaceConfigContext.Provider value={config}>
          {children}
        </WorkspaceConfigContext.Provider>
      </WorkspaceStoreProvider>
    </WorkspaceQueryClientProvider>
  );
}

/** Print the devMode next-step banner once per mount (never during render/SSR). */
function useDevModeBanner(devMode: boolean): void {
  const printed = useRef(false);
  useEffect(() => {
    if (!devMode || printed.current || typeof console === "undefined") return;
    printed.current = true;
    console.info(
      "%c[workspace-engine] devMode",
      "font-weight:bold",
      "\nRendering against a bundled sample contract — no data of yours is used.\n" +
        "Next step: define your first entity with defineEntity() and pass it via `contracts`,\n" +
        "then register your blocks (or keep @workspace-engine/ui's defaultBlocks).",
    );
  }, [devMode]);
}
