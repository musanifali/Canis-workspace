import type { ReactElement } from "react";

export interface BrokenBlockProps {
  blockId: string;
  blockType: string;
  /** Human-readable, non-technical explanation of why the block is broken. */
  reason: string;
  /** Optional technical detail (error message, missing field) for developers. */
  detail?: string | undefined;
}

/**
 * The read-time fallback for a block that cannot render — an unknown type, a
 * component that threw, or (card #17) a spec that references data the contract
 * no longer exposes. Headless and minimal: it announces itself via `role` and
 * `data-*` hooks so vendors can style it, and never throws. "Never a white
 * screen, never a silent drop."
 */
export function BrokenBlock({
  blockId,
  blockType,
  reason,
  detail,
}: BrokenBlockProps): ReactElement {
  return (
    <div
      role="alert"
      data-workspace-broken-block=""
      data-block-id={blockId}
      data-block-type={blockType}
    >
      <strong data-broken-title="">This block couldn’t be displayed.</strong>
      <span data-broken-reason="">{reason}</span>
      {detail ? <code data-broken-detail="">{detail}</code> : null}
    </div>
  );
}
