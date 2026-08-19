/**
 * The running release tag (#97) — stamped on every log line and error so
 * production issues map back to a version from the tag pipeline (v0.2.0+).
 * Set WORKSPACE_RELEASE in the deploy (e.g. the git tag); falls back to "dev".
 */
export const RELEASE = process.env.WORKSPACE_RELEASE ?? "dev";
