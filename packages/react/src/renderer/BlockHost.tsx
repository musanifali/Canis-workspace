import type { ErrorInfo, ReactElement } from "react";
import type {
  Binding,
  Block,
  EntityContract,
  RefreshPolicy,
} from "@workspace-engine/core";
import { useBlockQuery, type BlockDataState } from "../query/useBlockQuery";
import type {
  BlockComponent,
  BlockComponentRegistry,
  WorkspaceDataSource,
} from "./types";
import { BrokenBlock } from "./BrokenBlock";
import { BlockErrorBoundary } from "./BlockErrorBoundary";
import { BlockSkeleton } from "./BlockSkeleton";

type BlockErrorHandler = (block: Block, error: Error, info: ErrorInfo) => void;

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
  timeZone: string;
  refresh: RefreshPolicy;
  onBlockError?: BlockErrorHandler | undefined;
}

/**
 * Renders exactly one block. Resolves the component, decides static vs bound,
 * and picks the right presentation: skeleton while loading, BrokenBlock on an
 * unregistered type / missing contract / fetch failure, the component otherwise.
 * Calls no hooks itself so the static and bound paths can diverge cleanly; the
 * bound path delegates to BoundBlockHost, which owns the data hook.
 */
export function BlockHost({
  block,
  components,
  dataSource,
  timeZone,
  refresh,
  onBlockError,
}: BlockHostProps): ReactElement {
  const Component = components[block.type];
  if (!Component) {
    return (
      <BrokenBlock
        blockId={block.id}
        blockType={block.type}
        reason={`No component is registered for block type “${block.type}”.`}
      />
    );
  }

  if (!block.binding || !dataSource) {
    return (
      <BlockErrorBoundary block={block} onBlockError={onBlockError}>
        <Component block={block} {...STATIC_STATE} />
      </BlockErrorBoundary>
    );
  }

  const contract = dataSource.contracts[block.binding.entity];
  if (!contract) {
    return (
      <BrokenBlock
        blockId={block.id}
        blockType={block.type}
        reason={`No contract is registered for entity “${block.binding.entity}”.`}
      />
    );
  }

  return (
    <BoundBlockHost
      block={block}
      binding={block.binding}
      Component={Component}
      contract={contract}
      auth={dataSource.auth}
      timeZone={timeZone}
      refresh={refresh}
      onBlockError={onBlockError}
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
}: BoundBlockHostProps): ReactElement {
  const state = useBlockQuery({
    block,
    binding,
    contract,
    auth,
    timeZone,
    refresh,
  });

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
    <BlockErrorBoundary block={block} onBlockError={onBlockError}>
      <Component block={block} {...state} />
    </BlockErrorBoundary>
  );
}
