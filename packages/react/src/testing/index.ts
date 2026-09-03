/**
 * `@ticora/react/testing` — the block contract test kit (#110).
 *
 * A separate entry point on purpose: it is never part of the main bundle, and
 * it pulls in no react-dom and no testing library, so the SSR-compatible
 * `@ticora/react` surface and its size budget are unaffected.
 */
export {
  assertBlockContract,
  blockStates,
  BlockContractError,
  type ContractShape,
  type BlockState,
  type RenderFn,
  type AssertBlockContractOptions,
} from "./block-contract";
