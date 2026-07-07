import { Component, type ErrorInfo, type ReactNode } from "react";
import type { Block } from "@workspace-engine/core";
import { BrokenBlock } from "./BrokenBlock";

interface BlockErrorBoundaryProps {
  block: Block;
  children: ReactNode;
  /** Notified when a block throws, so hosts can log/report. Must not throw. */
  onBlockError?: ((block: Block, error: Error, info: ErrorInfo) => void) | undefined;
}

interface BlockErrorBoundaryState {
  error: Error | null;
}

/**
 * Isolates a single block's render errors. One throwing block degrades to a
 * BrokenBlock; its siblings keep rendering. Without this, an exception in any
 * block component would unmount the whole workspace tree.
 */
export class BlockErrorBoundary extends Component<
  BlockErrorBoundaryProps,
  BlockErrorBoundaryState
> {
  override state: BlockErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BlockErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onBlockError?.(this.props.block, error, info);
  }

  override render(): ReactNode {
    const { error } = this.state;
    const { block, children } = this.props;
    if (error) {
      return (
        <BrokenBlock
          blockId={block.id}
          blockType={block.type}
          reason="This block ran into an error while rendering."
          detail={error.message}
        />
      );
    }
    return children;
  }
}
