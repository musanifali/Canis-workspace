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
import type { BlockDegradationEvent, OnBlockDegraded } from "../renderer/degradation";
import {
  createTelemetryReporter,
  NOOP_TELEMETRY,
  type TelemetryOptions,
  type TelemetryReporter,
} from "../telemetry";
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
  /**
   * Anonymous SDK telemetry (card #52): integration funnel + degraded-render
   * events, documented schema only. OFF unless `{ enabled: true, endpoint }`
   * is passed explicitly — no ambient default, no network otherwise.
   */
  telemetry?: TelemetryOptions | undefined;
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
  telemetry,
  devMode = false,
  children,
}: WorkspaceProviderProps): ReactElement {
  const resolvedRegistry = registry ?? DEFAULT_REGISTRY;
  const resolvedApiKey = apiKey ?? (devMode ? "dev-mode" : "");

  useDevModeBanner(devMode);

  const reporter = useMemo(
    () => createTelemetryReporter(telemetry, resolvedApiKey),
    // Recreate only when the opt-in identity changes, not per render.
    [telemetry?.enabled, telemetry?.endpoint, telemetry?.fetch, resolvedApiKey],
  );
  useTelemetryFunnel(reporter, devMode, contracts.length, blocks.length);

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
    () => (store ?? createInMemoryWorkspaceStore()),
    [store],
  );
  const telemetryStore = useMemo(
    () => withFirstSaveTelemetry(resolvedStore, reporter),
    [resolvedStore, reporter],
  );

  // Merge the vendor's degradation callback with the telemetry emit; the
  // event's human/technical strings stay with the vendor — telemetry gets
  // only the reason + block type (documented anonymous schema).
  const reportDegraded = useMemo<OnBlockDegraded | undefined>(() => {
    if (reporter === NOOP_TELEMETRY) return onBlockDegraded;
    return (event: BlockDegradationEvent) => {
      reporter.emit("block.degraded", {
        reason: event.reason,
        blockType: event.blockType,
      });
      onBlockDegraded?.(event);
    };
  }, [reporter, onBlockDegraded]);

  const config = useMemo<WorkspaceConfig>(
    () => ({
      components,
      dataSource: { contracts: contractsByName, auth: userToken },
      validation,
      apiKey: resolvedApiKey,
      ...(reportDegraded ? { onBlockDegraded: reportDegraded } : {}),
    }),
    [components, contractsByName, userToken, validation, resolvedApiKey, reportDegraded],
  );

  return (
    <WorkspaceQueryClientProvider client={queryClient}>
      <WorkspaceStoreProvider store={telemetryStore} validation={validation}>
        <WorkspaceConfigContext.Provider value={config}>
          {children}
        </WorkspaceConfigContext.Provider>
      </WorkspaceStoreProvider>
    </WorkspaceQueryClientProvider>
  );
}

/** Emit the mount funnel event once, and flush pending events on unmount. */
function useTelemetryFunnel(
  reporter: TelemetryReporter,
  devMode: boolean,
  contractCount: number,
  blockCount: number,
): void {
  const mounted = useRef(false);
  useEffect(() => {
    if (reporter === NOOP_TELEMETRY || mounted.current) return;
    mounted.current = true;
    reporter.emit("provider.mounted", {
      devMode,
      contracts: contractCount,
      blocks: blockCount,
    });
    return () => reporter.flush();
    // Mount-once by design; counts are snapshotted into the first event.
  }, [reporter]);
}

/** Wrap a store so the first successful create emits `store.first_save`. */
function withFirstSaveTelemetry(
  store: WorkspaceStore,
  reporter: TelemetryReporter,
): WorkspaceStore {
  if (reporter === NOOP_TELEMETRY) return store;
  let saved = false;
  return {
    ...store,
    async create(spec) {
      const record = await store.create(spec);
      if (!saved) {
        saved = true;
        reporter.emit("store.first_save");
      }
      return record;
    },
  };
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
