import type { Block } from "@workspace-engine/core";

/**
 * A block's data binding failed to execute — the vendor `fetch` rejected, the
 * query violated the contract, or dates couldn't be resolved. Carries the block
 * it belongs to so the renderer can surface it *per block* (never a global error
 * that blanks the whole workspace) and preserves the underlying cause.
 */
export class BindingFetchError extends Error {
  readonly blockId: string;
  readonly entity: string;

  constructor(block: Block, cause: unknown) {
    const causeMessage =
      cause instanceof Error ? cause.message : String(cause);
    super(
      `binding for block "${block.id}"${
        block.binding ? ` (entity "${block.binding.entity}")` : ""
      } failed: ${causeMessage}`,
      { cause },
    );
    this.name = "BindingFetchError";
    this.blockId = block.id;
    this.entity = block.binding?.entity ?? "";
  }
}

/** Wrap any thrown value as a BindingFetchError, passing an existing one through. */
export function toBindingFetchError(cause: unknown, block: Block): BindingFetchError {
  return cause instanceof BindingFetchError
    ? cause
    : new BindingFetchError(block, cause);
}
