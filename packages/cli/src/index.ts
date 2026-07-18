/**
 * @workspace-engine/cli — the `canis` vendor CLI.
 *
 * All contract/spec IO lives in this package; the actual gating decision reuses
 * @workspace-engine/core's validateSpec unchanged (no forked validation). The
 * library exports below let the diff/lint logic be embedded programmatically
 * (and unit-tested) without going through argv.
 */
export { run, type CliIo } from "./cli.js";
export { parseArgs, resolveOption, type ParsedArgs } from "./args.js";

export {
  loadContractModule,
  toContractMap,
  ContractLoadError,
} from "./contracts/load.js";
export {
  diffContracts,
  type ContractDiff,
  type EntityContractDiff,
  type CapabilityRef,
} from "./contracts/static-diff.js";
export {
  lintContracts,
  hasLintErrors,
  type LintFinding,
  type LintSeverity,
} from "./contracts/lint.js";

export {
  analyzeBreakingChanges,
  type DiffAnalysis,
  type SpecImpact,
  type BreakReason,
  type Verdict,
  type AnalyzeOptions,
} from "./diff/analyze.js";

export {
  loadSpecsFromDir,
  loadSpecsFromService,
  type LoadedSpec,
  type ServiceSpecSource,
} from "./specs/load.js";

export {
  formatDiffHuman,
  diffJson,
  formatLintHuman,
  lintJson,
  type DiffMeta,
  type LintMeta,
} from "./report.js";
