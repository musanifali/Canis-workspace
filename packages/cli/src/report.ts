/**
 * Human- and JSON-readable rendering for `contracts diff`. Output is plain
 * ASCII (no color codes) so it reads cleanly in CI logs and is easy to assert
 * against in tests.
 */
import type { ContractDiff, EntityContractDiff } from "./contracts/static-diff.js";
import type { DiffAnalysis, SpecImpact } from "./diff/analyze.js";

export interface DiffMeta {
  baseline: string;
  proposed: string;
  source: string;
}

function describeCapabilityRef(ref: { capability: string; field: string; fn?: string }): string {
  return ref.fn ? `${ref.capability} ${ref.fn}(${ref.field})` : `${ref.capability} ${ref.field}`;
}

function formatEntityDiff(entity: EntityContractDiff): string[] {
  if (entity.status === "added") return [`  + ${entity.entity} (new entity)`];
  if (entity.status === "removed") return [`  - ${entity.entity} (entity removed)`];

  const lines = [`  ~ ${entity.entity}`];
  for (const field of entity.fieldsRemoved) lines.push(`      - removed field: ${field}`);
  for (const change of entity.fieldKindChanged) {
    lines.push(`      ~ field kind: ${change.field} ${change.from} -> ${change.to}`);
  }
  for (const ref of entity.capabilitiesRemoved) {
    lines.push(`      - removed capability: ${describeCapabilityRef(ref)}`);
  }
  if (entity.maxLimitLowered) {
    lines.push(`      ~ maxLimit lowered: ${entity.maxLimitLowered.from} -> ${entity.maxLimitLowered.to}`);
  }
  for (const field of entity.fieldsAdded) lines.push(`      + added field: ${field}`);
  for (const ref of entity.capabilitiesAdded) {
    lines.push(`      + added capability: ${describeCapabilityRef(ref)}`);
  }
  return lines;
}

function formatImpact(impact: SpecImpact): string[] {
  const label = impact.title ? `${impact.id} "${impact.title}"` : impact.id;
  const lines = [`  x ${label}  ${impact.oldVerdict} -> ${impact.newVerdict}`];
  for (const reason of impact.reasons) {
    const where = reason.blockId ? `[${reason.blockId}] ` : "";
    lines.push(`      ${where}${reason.message}`);
  }
  return lines;
}

/** Render the diff result for humans. */
export function formatDiffHuman(
  analysis: DiffAnalysis,
  contractDiff: ContractDiff,
  meta: DiffMeta,
): string {
  const lines: string[] = [];
  lines.push("canis contracts diff");
  lines.push(`  baseline: ${meta.baseline}`);
  lines.push(`  proposed: ${meta.proposed}`);
  lines.push(`  workspaces: ${analysis.total} (${meta.source})`);
  lines.push("");

  lines.push("Contract changes:");
  if (contractDiff.entities.length === 0) {
    lines.push("  (none)");
  } else {
    for (const entity of contractDiff.entities) lines.push(...formatEntityDiff(entity));
  }
  lines.push("");

  if (analysis.broken === 0) {
    lines.push(
      `OK — all ${analysis.total} workspace(s) still build under the proposed contracts.`,
    );
  } else {
    lines.push(
      `BREAKING — this change breaks ${analysis.broken} of ${analysis.total} saved workspace(s):`,
    );
    lines.push("");
    for (const impact of analysis.impacts.filter((i) => i.broken)) {
      lines.push(...formatImpact(impact));
    }
  }
  const notes: string[] = [];
  if (analysis.compatible > 0) notes.push(`${analysis.compatible} compatible`);
  if (analysis.fixed > 0) notes.push(`${analysis.fixed} newly build`);
  if (notes.length > 0) {
    lines.push("");
    lines.push(`(${notes.join("; ")})`);
  }
  return lines.join("\n");
}

/** Render the diff result as a stable JSON object. */
export function diffJson(
  analysis: DiffAnalysis,
  contractDiff: ContractDiff,
  meta: DiffMeta,
): unknown {
  return {
    command: "contracts diff",
    baseline: meta.baseline,
    proposed: meta.proposed,
    source: meta.source,
    summary: {
      total: analysis.total,
      broken: analysis.broken,
      compatible: analysis.compatible,
      fixed: analysis.fixed,
    },
    contractDiff,
    workspaces: analysis.impacts,
  };
}
