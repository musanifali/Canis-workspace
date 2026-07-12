/**
 * @workspace-engine/devtools — dev-only inspector for the generative loop.
 *
 * Mount <WorkspaceDevtools /> once (it returns null in production), wrap the
 * renderer's provider with <DevtoolsQueryReporter />, and call recordSpec /
 * recordVerdict from your gate. Everything flows through the bus; nothing here
 * touches the renderer or ships to production.
 */
export { WorkspaceDevtools } from "./WorkspaceDevtools";
export { DevtoolsQueryReporter } from "./DevtoolsQueryReporter";
export {
  recordSpec,
  recordVerdict,
  recordQuery,
  clearDevtoolsLog,
  useDevtoolsLog,
  type DevtoolsEvent,
  type VerdictReason,
} from "./bus";
