import type { ErrorInfo, ReactElement } from "react";
import type {
  Binding,
  Block,
  EntityContract,
  RefreshPolicy,
} from "@workspace-engine/core";
import { useBlockQuery, type BlockDataState } from "../query/useBlockQuery";
import { useRuntimeFilters } from "../query/filters";
import type {
  BlockComponent,
  BlockComponentRegistry,
  WorkspaceDataSource,
} from "./types";
import { BrokenBlock } from "./BrokenBlock";
import { BlockErrorBoundary } from "./BlockErrorBoundary";
import { BlockSkeleton } from "./BlockSkeleton";
import {
  useReportDegradation,
  type BlockDegradationEvent,
  type OnBlockDegraded,
} from "./degradation";

type BlockErrorHandler = (block: Block, error: Error, info: ErrorInfo) => void;

/** A contract-drift error precomputed for a block by the grid (validateSpec). */
export interface BlockDriftError {
  message: string;
  fix: string;
}

/** State handed to a static block (no binding, or no data source wired). */
const STATIC_STATE: BlockDataState = {
  status: "success",
  data: undefined,
  error: null,
  isFetching: false,
  dataUpdatedAt: null,
  refetch: () => {},
};

export interface BlockHostProps {
  block: Block;
  components: BlockComponentRegistry;
  dataSource?: WorkspaceDataSource | undefined;
  /** Contract-drift error for this block from read-time validation, if any. */
  driftError?: BlockDriftError | undefined;
  timeZone: string;
  refresh: RefreshPolicy;
  onBlockError?: BlockErrorHandler | undefined;
  onBlockDegraded?: OnBlockDegraded | undefined;
}

type Outcome =
  | { kind: "broken"; event: BlockDegradationEvent }
  | { kind: "static"; Component: BlockComponent }
  | { kind: "bound"; Component: BlockComponent; binding: Binding; contract: EntityContract };

function resolveOutcome(
  block: Block,
  components: BlockComponentRegistry,
  dataSource: WorkspaceDataSource | undefined,
  driftError: BlockDriftError | undefined,
): Outcome {
  const Component = components[block.type];
  const broke = (
    reason: BlockDegradationEvent["reason"],
    message: string,
    detail?: string,
  ): Outcome => ({
    kind: "broken",
    event: { blockId: block.id, blockType: block.type, reason, message, detail },
  });

  if (!Component) {
    return broke(
      "unknown-type",
      `No component is registered for block type “${block.type}”.`,
    );
  }
  if (!block.binding || !dataSource) {
    return { kind: "static", Component };
  }
  if (driftError) {
    return broke("contract-drift", driftError.message, driftError.fix);
  }
  const contract = dataSource.contracts[block.binding.entity];
  if (!contract) {
    return broke(
      "missing-contract",
      `No contract is registered for entity “${block.binding.entity}”.`,
    );
  }
  return { kind: "bound", Component, binding: block.binding, contract };
}

/**
 * Renders exactly one block, choosing the right presentation and emitting a
 * degradation telemetry event whenever it can't render the real thing:
 * unknown type, missing contract, or contract drift (all known synchronously
 * here); loading → skeleton; healthy → the component. Fetch failures and render
 * throws degrade inside the bound path / error boundary. Calls the telemetry
 * hook unconditionally so it fires once per distinct degradation.
 */
export function BlockHost({
  block,
  components,
  dataSource,
  driftError,
  timeZone,
  refresh,
  onBlockError,
  onBlockDegraded,
}: BlockHostProps): ReactElement {
  const outcome = resolveOutcome(block, components, dataSource, driftError);
  useReportDegradation(outcome.kind === "broken" ? outcome.event : null, onBlockDegraded);

  if (outcome.kind === "broken") {
    return (
      <BrokenBlock
        blockId={block.id}
        blockType={block.type}
        reason={outcome.event.message}
        detail={outcome.event.detail}
      />
    );
  }

  if (outcome.kind === "static") {
    return (
      <BlockErrorBoundary block={block} onBlockError={onBlockError} onBlockDegraded={onBlockDegraded}>
        <outcome.Component block={block} {...STATIC_STATE} />
      </BlockErrorBoundary>
    );
  }

  return (
    <BoundBlockHost
      block={block}
      binding={outcome.binding}
      Component={outcome.Component}
      contract={outcome.contract}
      auth={dataSource!.auth}
      timeZone={timeZone}
      refresh={refresh}
      onBlockError={onBlockError}
      onBlockDegraded={onBlockDegraded}
    />
  );
}

interface BoundBlockHostProps {
  block: Block;
  binding: Binding;
  Component: BlockComponent;
  contract: EntityContract;
  auth: unknown;
  timeZone: string;
  refresh: RefreshPolicy;
  onBlockError?: BlockErrorHandler | undefined;
  onBlockDegraded?: OnBlockDegraded | undefined;
}

function BoundBlockHost({
  block,
  binding,
  Component,
  contract,
  auth,
  timeZone,
  refresh,
  onBlockError,
  onBlockDegraded,
}: BoundBlockHostProps): ReactElement {
  const runtimeFilters = useRuntimeFilters(block.id);
  const state = useBlockQuery({ block, binding, contract, auth, timeZone, refresh, runtimeFilters });

  const degradation: BlockDegradationEvent | null =
    state.status === "error"
      ? {
          blockId: block.id,
          blockType: block.type,
          reason: "fetch-error",
          message: "This block couldn’t load its data.",
          detail: state.error?.message,
        }
      : null;
  useReportDegradation(degradation, onBlockDegraded);

  if (state.status === "loading") {
    return <BlockSkeleton />;
  }

  if (state.status === "error") {
    return (
      <BrokenBlock
        blockId={block.id}
        blockType={block.type}
        reason="This block couldn’t load its data."
        detail={state.error?.message}
      />
    );
  }

  return (
    <BlockErrorBoundary block={block} onBlockError={onBlockError} onBlockDegraded={onBlockDegraded}>
      <Component block={block} {...state} />
    </BlockErrorBoundary>
  );
}
