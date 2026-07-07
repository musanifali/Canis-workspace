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
  filterSchema,
  sortSchema,
  aggregationSchema,
  querySpecSchema,
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
