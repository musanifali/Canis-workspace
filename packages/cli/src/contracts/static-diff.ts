/**
 * Pure structural diff of two contract sets (old vs new). This is *context*
 * for `contracts diff` — the authoritative breakage signal comes from running
 * validateSpec against each set (see ../diff/analyze.ts). Removals and
 * narrowings are the changes that can break saved workspaces; additions and
 * widenings never do.
 */
import type { EntityContract, FieldKind } from "@workspace-engine/core";

export interface CapabilityRef {
  /** filterable | sortable | groupable | aggregation */
  capability: string;
  field: string;
  /** For aggregation refs, the fn, e.g. "sum". */
  fn?: string;
}

export interface EntityContractDiff {
  entity: string;
  status: "added" | "removed" | "changed";
  fieldsAdded: string[];
  fieldsRemoved: string[];
  fieldKindChanged: { field: string; from: FieldKind; to: FieldKind }[];
  capabilitiesAdded: CapabilityRef[];
  capabilitiesRemoved: CapabilityRef[];
  maxLimitLowered?: { from: number; to: number };
}

export interface ContractDiff {
  entities: EntityContractDiff[];
  /** True when any removal/narrowing exists (breaking-candidate change). */
  hasNarrowing: boolean;
}

function capabilityRefs(contract: EntityContract): CapabilityRef[] {
  const caps = contract.capabilities;
  const refs: CapabilityRef[] = [];
  for (const field of caps.filterable) refs.push({ capability: "filterable", field });
  for (const field of caps.sortable) refs.push({ capability: "sortable", field });
  for (const field of caps.groupable) refs.push({ capability: "groupable", field });
  for (const [field, fns] of Object.entries(caps.aggregations)) {
    for (const fn of fns) refs.push({ capability: "aggregation", field, fn });
  }
  return refs;
}

function refKey(ref: CapabilityRef): string {
  return `${ref.capability}:${ref.field}${ref.fn ? `:${ref.fn}` : ""}`;
}

function diffEntity(
  entity: string,
  oldContract: EntityContract,
  newContract: EntityContract,
): EntityContractDiff | undefined {
  const oldFields = oldContract.fields;
  const newFields = newContract.fields;
  const fieldsAdded = Object.keys(newFields).filter((f) => !(f in oldFields));
  const fieldsRemoved = Object.keys(oldFields).filter((f) => !(f in newFields));
  const fieldKindChanged = Object.keys(oldFields)
    .filter((f) => f in newFields && oldFields[f] !== newFields[f])
    .map((f) => ({ field: f, from: oldFields[f]!, to: newFields[f]! }));

  const oldCaps = new Map(capabilityRefs(oldContract).map((r) => [refKey(r), r]));
  const newCaps = new Map(capabilityRefs(newContract).map((r) => [refKey(r), r]));
  const capabilitiesAdded = [...newCaps].filter(([k]) => !oldCaps.has(k)).map(([, r]) => r);
  const capabilitiesRemoved = [...oldCaps].filter(([k]) => !newCaps.has(k)).map(([, r]) => r);

  const oldMax = oldContract.capabilities.maxLimit;
  const newMax = newContract.capabilities.maxLimit;
  const maxLimitLowered = newMax < oldMax ? { from: oldMax, to: newMax } : undefined;

  const changed =
    fieldsAdded.length > 0 ||
    fieldsRemoved.length > 0 ||
    fieldKindChanged.length > 0 ||
    capabilitiesAdded.length > 0 ||
    capabilitiesRemoved.length > 0 ||
    maxLimitLowered !== undefined;
  if (!changed) return undefined;

  return {
    entity,
    status: "changed",
    fieldsAdded,
    fieldsRemoved,
    fieldKindChanged,
    capabilitiesAdded,
    capabilitiesRemoved,
    ...(maxLimitLowered ? { maxLimitLowered } : {}),
  };
}

function emptyDiff(entity: string, status: "added" | "removed"): EntityContractDiff {
  return {
    entity,
    status,
    fieldsAdded: [],
    fieldsRemoved: [],
    fieldKindChanged: [],
    capabilitiesAdded: [],
    capabilitiesRemoved: [],
  };
}

/** Compute the structural diff between a baseline and proposed contract set. */
export function diffContracts(
  oldContracts: readonly EntityContract[],
  newContracts: readonly EntityContract[],
): ContractDiff {
  const oldByName = new Map(oldContracts.map((c) => [c.name, c]));
  const newByName = new Map(newContracts.map((c) => [c.name, c]));
  const names = [...new Set([...oldByName.keys(), ...newByName.keys()])].sort();

  const entities: EntityContractDiff[] = [];
  for (const name of names) {
    const before = oldByName.get(name);
    const after = newByName.get(name);
    if (before && !after) entities.push(emptyDiff(name, "removed"));
    else if (!before && after) entities.push(emptyDiff(name, "added"));
    else if (before && after) {
      const diff = diffEntity(name, before, after);
      if (diff) entities.push(diff);
    }
  }

  const hasNarrowing = entities.some(
    (e) =>
      e.status === "removed" ||
      e.fieldsRemoved.length > 0 ||
      e.fieldKindChanged.length > 0 ||
      e.capabilitiesRemoved.length > 0 ||
      e.maxLimitLowered !== undefined,
  );

  return { entities, hasNarrowing };
}
