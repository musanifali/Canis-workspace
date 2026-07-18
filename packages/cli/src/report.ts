/**
 * Human- and JSON-readable rendering for both subcommands. Output is plain
 * ASCII (no color codes) so it reads cleanly in CI logs and is easy to assert
 * against in tests.
 */
import type { EntityContract } from "@workspace-engine/core";
import type { ContractDiff, EntityContractDiff } from "./contracts/static-diff.js";
import type { DiffAnalysis, SpecImpact } from "./diff/analyze.js";
import type { LintFinding } from "./contracts/lint.js";

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

export interface LintMeta {
  contracts: string;
  entityCount: number;
}

/** Render lint findings for humans. */
export function formatLintHuman(findings: readonly LintFinding[], meta: LintMeta): string {
  const lines: string[] = [];
  lines.push("canis contracts lint");
  lines.push(`  contracts: ${meta.contracts} (${meta.entityCount} entit${meta.entityCount === 1 ? "y" : "ies"})`);
  lines.push("");

  const errors = findings.filter((f) => f.severity === "error").length;
  const warnings = findings.filter((f) => f.severity === "warning").length;

  if (findings.length === 0) {
    lines.push("OK — no contract quality issues found.");
    return lines.join("\n");
  }

  const byEntity = new Map<string, LintFinding[]>();
  for (const finding of findings) {
    const list = byEntity.get(finding.entity) ?? [];
    list.push(finding);
    byEntity.set(finding.entity, list);
  }
  for (const [entity, list] of [...byEntity].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`${entity}:`);
    for (const finding of list) {
      const tag = finding.severity === "error" ? "error" : "warn ";
      lines.push(`  ${tag}  ${finding.message}  (${finding.code})`);
    }
    lines.push("");
  }
  lines.push(`${errors} error(s), ${warnings} warning(s).`);
  return lines.join("\n");
}

/** Render lint findings as a stable JSON object. */
export function lintJson(findings: readonly LintFinding[], meta: LintMeta): unknown {
  return {
    command: "contracts lint",
    contracts: meta.contracts,
    entityCount: meta.entityCount,
    summary: {
      errors: findings.filter((f) => f.severity === "error").length,
      warnings: findings.filter((f) => f.severity === "warning").length,
    },
    findings,
  };
}

/** Declarative summary of one contract for the dev playground. */
function summarizeContract(contract: EntityContract): string[] {
  const caps = contract.capabilities;
  const serverOps = (["filter", "sort", "group", "aggregate"] as const)
    .filter((op) => caps.execution[op] === "server");
  const lines = [`${contract.name}:`];
  lines.push(
    `  fields: ${Object.entries(contract.fields)
      .map(([field, kind]) => `${field}(${kind})`)
      .join(", ")}`,
  );
  lines.push(`  filterable: ${[...caps.filterable].join(", ") || "(none)"}`);
  lines.push(`  sortable:   ${[...caps.sortable].join(", ") || "(none)"}`);
  lines.push(`  groupable:  ${[...caps.groupable].join(", ") || "(none)"}`);
  const aggs = Object.entries(caps.aggregations)
    .map(([field, fns]) => `${field}[${fns.join(",")}]`)
    .join(", ");
  lines.push(`  aggregations: ${aggs || "(none)"}`);
  lines.push(
    `  execution: ${serverOps.length > 0 ? `server for ${serverOps.join("/")}` : "client (engine enforces everything)"}` +
      `; limits ${caps.defaultLimit}/${caps.maxLimit}`,
  );
  return lines;
}

/** Render the dev playground report: summary + merged lint/probe findings. */
export function formatDevHuman(
  contracts: readonly EntityContract[],
  findings: readonly LintFinding[],
  meta: LintMeta,
): string {
  const lines: string[] = [];
  lines.push("canis contracts dev");
  lines.push(`  contracts: ${meta.contracts} (${meta.entityCount} entit${meta.entityCount === 1 ? "y" : "ies"})`);
  lines.push("");
  for (const contract of contracts) {
    lines.push(...summarizeContract(contract));
    lines.push("");
  }
  lines.push("Checks (lint + conformance probes):");
  lines.push(formatLintHuman(findings, meta).split("\n").slice(3).join("\n"));
  return lines.join("\n");
}

/** Render the dev playground report as a stable JSON object. */
export function devJson(
  contracts: readonly EntityContract[],
  findings: readonly LintFinding[],
  meta: LintMeta,
): unknown {
  return {
    command: "contracts dev",
    contracts: meta.contracts,
    entityCount: meta.entityCount,
    entities: contracts.map((contract) => ({
      name: contract.name,
      fields: contract.fields,
      capabilities: {
        filterable: [...contract.capabilities.filterable],
        sortable: [...contract.capabilities.sortable],
        groupable: [...contract.capabilities.groupable],
        aggregations: contract.capabilities.aggregations,
        execution: contract.capabilities.execution,
        defaultLimit: contract.capabilities.defaultLimit,
        maxLimit: contract.capabilities.maxLimit,
      },
    })),
    summary: {
      errors: findings.filter((f) => f.severity === "error").length,
      warnings: findings.filter((f) => f.severity === "warning").length,
    },
    findings,
  };
}
