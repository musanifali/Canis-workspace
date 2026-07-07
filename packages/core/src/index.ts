/**
 * @workspace-engine/core — Workspace Spec v1 schemas, types, and pure helpers.
 *
 * Contract source: devdocs/workspace-spec-v1.md. This package is pure by
 * charter: no React, no DB, no fetch; zod is the only runtime dependency.
 */
export {
  isoDateSchema,
  isoDateTimeSchema,
  relativeTokenSchema,
  absoluteDateValueSchema,
  relativeDateValueSchema,
  dateValueSchema,
  timezoneSchema,
  type RelativeToken,
  type DateValue,
  type Timezone,
} from "./spec/time.js";
export { frameSchema, GRID_COLUMNS, type Frame } from "./spec/frame.js";
export {
  fieldNameSchema,
  filterValueSchemas,
  filterSchema,
  sortSchema,
  aggregationSchema,
  querySpecSchema,
  deriveBindingShape,
  type BindingShape,
  type FilterOp,
  type Filter,
  type Sort,
  type Aggregation,
  type QuerySpec,
} from "./spec/query.js";
export {
  blockIdSchema,
  blockTypeSchema,
  bindingSchema,
  blockSchema,
  type BlockId,
  type Binding,
  type Block,
} from "./spec/block.js";
export {
  SPEC_VERSION,
  refreshPolicySchema,
  layoutSchema,
  workspaceSpecSchema,
  type RefreshPolicy,
  type WorkspaceSpec,
} from "./spec/workspace.js";
export { parseSpec, serializeSpec, SpecParseError } from "./spec/serde.js";
export {
  defineEntity,
  ContractDefinitionError,
  type FieldKind,
  type AggregationFn,
  type EntityCapabilities,
  type DefineEntityArgs,
  type EntityContract,
} from "./contract/define-entity.js";
export {
  compileToTools,
  compileToValidator,
  compileToExecutor,
  QueryPolicyError,
  OPS_BY_KIND,
  type CompiledTool,
  type PolicyViolation,
  type PolicyViolationCode,
} from "./contract/compile.js";
export {
  DEFAULT_REGISTRY,
  type BlockRegistry,
  type BlockRegistryEntry,
} from "./registry/registry.js";
export {
  validateSpec,
  MAX_BLOCKS,
  type TenantPolicy,
  type ValidationContext,
  type ValidationVerdict,
  type ValidationNote,
  type ClarifyQuestion,
  type SpecValidationError,
} from "./validate/validate-spec.js";
