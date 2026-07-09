import { useEffect, useState, type CSSProperties, type ReactElement } from "react";
import { useWorkspaceFilters, type BlockComponentProps } from "@workspace-engine/react";
import type { Filter } from "@workspace-engine/core";
import { tokens } from "../theme";

const inputStyle: CSSProperties = {
  padding: "4px 6px",
  border: `1px solid ${tokens.border}`,
  borderRadius: "4px",
  background: tokens.bg,
  color: tokens.fg,
  fontSize: "1em",
};

const buttonStyle: CSSProperties = {
  padding: "4px 10px",
  border: `1px solid ${tokens.border}`,
  borderRadius: "4px",
  background: tokens.surface,
  color: tokens.fg,
  cursor: "pointer",
};

/**
 * Default FilterBar (block type "FilterBar"). Renders a native text input per
 * `config.fields` and pushes a `contains` filter per non-empty field onto every
 * `config.targets` block via the runtime filter bus — the target blocks refetch
 * with the extra filters merged in, without ever mutating the saved spec. Native
 * form/label/input/button throughout (Phase 0 a11y lesson: no clickable divs).
 */
export function FilterBar({ block }: BlockComponentProps): ReactElement {
  const { setBlockFilters } = useWorkspaceFilters();
  const targets = (block.config.targets as string[] | undefined) ?? [];
  const fields = (block.config.fields as string[] | undefined) ?? [];
  const [values, setValues] = useState<Record<string, string>>({});

  const targetsKey = targets.join(",");
  const fieldsKey = fields.join(",");

  useEffect(() => {
    const filters: Filter[] = fields
      .filter((f) => (values[f] ?? "").trim() !== "")
      .map((f) => ({ field: f, op: "contains", value: (values[f] ?? "").trim() }));
    for (const target of targets) setBlockFilters(target, filters);
    // targetsKey/fieldsKey stand in for the (stable-valued) config arrays.
  }, [values, targetsKey, fieldsKey, setBlockFilters]); // eslint-disable-line

  return (
    <form
      data-testid="ui-filterbar"
      role="search"
      aria-label="Filter"
      onSubmit={(e) => e.preventDefault()}
      style={{
        display: "flex",
        gap: tokens.gap,
        alignItems: "flex-end",
        flexWrap: "wrap",
        height: "100%",
        boxSizing: "border-box",
        padding: tokens.pad,
        background: tokens.bg,
        color: tokens.fg,
        border: `1px solid ${tokens.border}`,
        borderRadius: tokens.radius,
        fontSize: tokens.fontSize,
        fontFamily: tokens.fontFamily,
      }}
    >
      {fields.map((field) => (
        <label key={field} style={{ display: "flex", flexDirection: "column", gap: "2px", color: tokens.muted, fontSize: "0.85em" }}>
          {field}
          <input
            type="text"
            name={field}
            value={values[field] ?? ""}
            aria-label={`Filter by ${field}`}
            onChange={(e) => setValues((v) => ({ ...v, [field]: e.target.value }))}
            style={inputStyle}
          />
        </label>
      ))}
      <button type="button" onClick={() => setValues({})} style={buttonStyle}>
        Clear
      </button>
    </form>
  );
}
