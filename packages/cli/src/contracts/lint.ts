/**
 * Pure static quality checks on a vendor's contract definitions (`contracts
 * lint`, card #49). These make generation quality legible: a vendor whose
 * fields have no descriptions and whose enums are undocumented is starving the
 * model of the context it needs, and should see that here rather than blaming
 * the model for weak specs.
 *
 * Severities: `error` (structurally broken — non-zero exit) vs `warning`
 * (quality smell). All checks are pure over the resolved EntityContract plus
 * its Zod schema; the CLI layer decides exit codes.
 */
import type { EntityContract } from "@workspace-engine/core";
import { describedText, enumOptions, objectDescription } from "./zod-introspect.js";

export type LintSeverity = "error" | "warning";

export interface LintFinding {
  entity: string;
  severity: LintSeverity;
  code: string;
  message: string;
  field?: string;
}

/** Descriptions this short or in this set read as placeholders, not documentation. */
const MIN_DESCRIPTION_LENGTH = 12;
const VAGUE_DESCRIPTIONS = new Set([
  "field",
  "the field",
  "data",
  "value",
  "id",
  "name",
  "n/a",
  "na",
  "todo",
  "tbd",
  "fixme",
  "description",
  "a field",
  "column",
]);

function isVague(description: string): boolean {
  const normalized = description.trim().toLowerCase();
  return normalized.length < MIN_DESCRIPTION_LENGTH || VAGUE_DESCRIPTIONS.has(normalized);
}

/** All fields any capability references (used for the existence check). */
function capabilityFields(contract: EntityContract): { capability: string; field: string }[] {
  const caps = contract.capabilities;
  const refs: { capability: string; field: string }[] = [];
  for (const field of caps.filterable) refs.push({ capability: "filterable", field });
  for (const field of caps.sortable) refs.push({ capability: "sortable", field });
  for (const field of caps.groupable) refs.push({ capability: "groupable", field });
  for (const field of Object.keys(caps.aggregations)) refs.push({ capability: "aggregations", field });
  return refs;
}

function lintEntity(contract: EntityContract): LintFinding[] {
  const findings: LintFinding[] = [];
  const entity = contract.name;
  const push = (
    severity: LintSeverity,
    code: string,
    message: string,
    field?: string,
  ) => findings.push({ entity, severity, code, message, ...(field ? { field } : {}) });

  // --- structural: a capability naming a field the schema does not declare.
  // defineEntity guards this at construction, so it normally cannot occur in a
  // resolved contract; it CAN when a contract is reconstructed from stored JSON
  // (the service's serialized `definition`) which bypasses that guard. Kept as a
  // real error so lint is authoritative regardless of how the contract was built.
  for (const { capability, field } of capabilityFields(contract)) {
    if (!(field in contract.fields)) {
      push(
        "error",
        "capability_unknown_field",
        `capability "${capability}" references field "${field}", which the ${entity} schema does not declare`,
        field,
      );
    }
  }

  // --- entity-level description.
  const entityDescription = objectDescription(contract.schema);
  if (!entityDescription) {
    push(
      "warning",
      "missing_entity_description",
      `entity "${entity}" has no description; the model uses it to pick the right entity`,
    );
  } else if (isVague(entityDescription)) {
    push(
      "warning",
      "vague_entity_description",
      `entity "${entity}" description "${entityDescription}" is too vague to guide generation`,
    );
  }

  // --- per-field descriptions and enum value documentation.
  const shape = contract.schema.shape as Record<string, unknown>;
  for (const [field, kind] of Object.entries(contract.fields)) {
    const fieldType = shape[field];
    const description = fieldType === undefined ? undefined : describedText(fieldType);

    if (!description) {
      push(
        "warning",
        "missing_field_description",
        `field "${field}" has no description`,
        field,
      );
      continue; // no description → nothing to judge for vagueness / enum docs
    }
    if (isVague(description)) {
      push(
        "warning",
        "vague_field_description",
        `field "${field}" description "${description}" is too vague`,
        field,
      );
    }
    if (kind === "enum" && fieldType !== undefined) {
      const options = enumOptions(fieldType) ?? [];
      const lower = description.toLowerCase();
      const undocumented = options.filter((option) => !lower.includes(option.toLowerCase()));
      for (const option of undocumented) {
        push(
          "warning",
          "enum_value_undocumented",
          `enum field "${field}" does not document value "${option}"; list what each value means so the model filters correctly`,
          field,
        );
      }
    }
  }

  return findings;
}

/** Run every quality check across a contract set. */
export function lintContracts(contracts: readonly EntityContract[]): LintFinding[] {
  return contracts.flatMap(lintEntity);
}

/** Convenience: does this finding set gate CI (any error)? */
export function hasLintErrors(findings: readonly LintFinding[]): boolean {
  return findings.some((finding) => finding.severity === "error");
}
