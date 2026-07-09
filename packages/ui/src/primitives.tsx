import type { CSSProperties, ReactElement, ReactNode } from "react";
import { tokens } from "./theme";

export const panelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  boxSizing: "border-box",
  overflow: "hidden",
  background: tokens.bg,
  color: tokens.fg,
  border: `1px solid ${tokens.border}`,
  borderRadius: tokens.radius,
  fontSize: tokens.fontSize,
  fontFamily: tokens.fontFamily,
};

const headerStyle: CSSProperties = {
  padding: tokens.pad,
  borderBottom: `1px solid ${tokens.border}`,
  fontWeight: 600,
  flex: "0 0 auto",
};

/** A themed surface container with an optional titled header. */
export function Panel({
  title,
  children,
  testId,
}: {
  title?: string | undefined;
  children: ReactNode;
  testId?: string;
}): ReactElement {
  return (
    <section style={panelStyle} data-testid={testId}>
      {title ? <header style={headerStyle}>{title}</header> : null}
      {children}
    </section>
  );
}

/** Render an unknown cell value for display (numbers rounded, nil as em dash). */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export function intentColor(intent: unknown): string {
  if (intent === "positive") return tokens.positive;
  if (intent === "negative") return tokens.negative;
  return tokens.fg;
}
