/**
 * The SDK's typed error taxonomy — one import site for every error the
 * Workspace Engine throws, so integrators can `instanceof`-branch deliberately
 * rather than string-match messages. Each class sets a distinct `.name`.
 *
 * Read-path / SDK errors:
 * - BindingFetchError        — a block's data binding failed (fetch/policy/zone)
 * - BlockRegistrationError   — an invalid block definition at registration
 * - WorkspaceNotFoundError   — store lookup for an unknown workspace id
 * - WorkspaceEditorSaveError — save() rejected because the draft failed validation
 *
 * Re-exported core (write-path) errors:
 * - ContractDefinitionError  — defineEntity given an invalid contract
 * - QueryPolicyError         — a query violates its contract's policy
 * - SpecParseError           — a spec failed the shape schema
 * - SpecMigrationError       — a spec migration chain problem
 */
export { BindingFetchError } from "./query/errors";
export { BlockRegistrationError } from "./provider/defineBlock";
export { WorkspaceNotFoundError } from "./workspace/store";
export { WorkspaceEditorSaveError } from "./workspace/useWorkspaceEditor";

export {
  ContractDefinitionError,
  QueryPolicyError,
  SpecParseError,
  SpecMigrationError,
} from "@workspace-engine/core";
