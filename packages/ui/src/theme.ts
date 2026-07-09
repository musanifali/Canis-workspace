/**
 * Design tokens as CSS custom properties with sensible fallbacks. Every default
 * block styles itself through these, so a vendor themes the whole set by setting
 * `--we-*` variables on any ancestor element — no CSS import, no build step, and
 * SSR-safe (the fallbacks render identically on server and client).
 *
 * @example
 * <div style={{ ["--we-accent" as string]: "#7c3aed", ["--we-radius" as string]: "12px" }}>
 *   <WorkspaceRenderer spec={spec} />
 * </div>
 */
export const tokens = {
  bg: "var(--we-bg, #ffffff)",
  surface: "var(--we-surface, #f9fafb)",
  fg: "var(--we-fg, #111827)",
  muted: "var(--we-muted, #6b7280)",
  border: "var(--we-border, #e5e7eb)",
  accent: "var(--we-accent, #2563eb)",
  positive: "var(--we-positive, #16a34a)",
  negative: "var(--we-negative, #dc2626)",
  radius: "var(--we-radius, 8px)",
  gap: "var(--we-gap, 8px)",
  pad: "var(--we-pad, 10px)",
  fontSize: "var(--we-font-size, 13px)",
  fontFamily: "var(--we-font-family, inherit)",
} as const;

/** The list of themeable custom properties, for documentation/tests. */
export const TOKEN_NAMES = [
  "--we-bg",
  "--we-surface",
  "--we-fg",
  "--we-muted",
  "--we-border",
  "--we-accent",
  "--we-positive",
  "--we-negative",
  "--we-radius",
  "--we-gap",
  "--we-pad",
  "--we-font-size",
  "--we-font-family",
] as const;
