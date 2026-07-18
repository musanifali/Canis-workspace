/**
 * The heart of `contracts diff`: for every saved spec, run the EXISTING
 * validateSpec against the old contracts and against the new contracts, and
 * classify the verdict transition. A spec that was BUILD and is no longer
 * BUILD is broken by the contract change. Every reason we print comes straight
 * from the validator's own typed errors — there is no parallel validation path
 * here, so this can never drift from gatePlan.
 */
import {
  validateSpec,
  type BlockRegistry,
  type EntityContract,
  type TenantPolicy,
  type ValidationVerdict,
} from "@workspace-engine/core";
import type { LoadedSpec } from "../specs/load.js";

export type Verdict = ValidationVerdict["verdict"];

/** One reason a spec fails under the new contracts, named by the validator. */
export interface BreakReason {
  code: string;
  message: string;
  fix?: string;
  blockId?: string;
  entity?: string;
  field?: string;
}

export interface SpecImpact {
  id: string;
  source: string;
  title?: string;
  oldVerdict: Verdict;
  newVerdict: Verdict;
  /** BUILD under the old contracts, not BUILD under the new ones. */
  broken: boolean;
  /** Was not BUILD under old, is BUILD under new (informational). */
  fixed: boolean;
  /** Reasons the new verdict is not BUILD (empty when new is BUILD). */
  reasons: BreakReason[];
}

export interface DiffAnalysis {
  impacts: SpecImpact[];
  total: number;
  broken: number;
  compatible: number;
  fixed: number;
}

export interface AnalyzeOptions {
  registry?: BlockRegistry;
  policy?: TenantPolicy;
}

function reasonsFromVerdict(verdict: ValidationVerdict): BreakReason[] {
  if (verdict.verdict === "REJECT") {
    return verdict.errors.map((error) => ({
      code: error.code,
      message: error.message,
      fix: error.fix,
      ...(error.blockId ? { blockId: error.blockId } : {}),
      ...("entity" in error && error.entity ? { entity: error.entity } : {}),
      ...("field" in error && error.field ? { field: error.field } : {}),
    }));
  }
  if (verdict.verdict === "CLARIFY") {
    return verdict.questions.map((question) => ({
      code: "Clarify",
      message: question.question,
      ...(question.blockId ? { blockId: question.blockId } : {}),
    }));
  }
  return [];
}

/**
 * Classify each spec's old→new verdict transition against the two contract sets.
 *
 * @param oldContracts Baseline contract map keyed by entity name.
 * @param newContracts Proposed contract map keyed by entity name.
 */
export function analyzeBreakingChanges(
  specs: readonly LoadedSpec[],
  oldContracts: Record<string, EntityContract>,
  newContracts: Record<string, EntityContract>,
  options: AnalyzeOptions = {},
): DiffAnalysis {
  const impacts: SpecImpact[] = [];

  for (const loaded of specs) {
    const oldVerdictResult = validateSpec(loaded.spec, {
      contracts: oldContracts,
      ...(options.registry ? { registry: options.registry } : {}),
      ...(options.policy ? { policy: options.policy } : {}),
    });
    const newVerdictResult = validateSpec(loaded.spec, {
      contracts: newContracts,
      ...(options.registry ? { registry: options.registry } : {}),
      ...(options.policy ? { policy: options.policy } : {}),
    });

    const oldVerdict = oldVerdictResult.verdict;
    const newVerdict = newVerdictResult.verdict;
    const broken = oldVerdict === "BUILD" && newVerdict !== "BUILD";
    const fixed = oldVerdict !== "BUILD" && newVerdict === "BUILD";

    impacts.push({
      id: loaded.id,
      source: loaded.source,
      ...(loaded.title ? { title: loaded.title } : {}),
      oldVerdict,
      newVerdict,
      broken,
      fixed,
      reasons: reasonsFromVerdict(newVerdictResult),
    });
  }

  const broken = impacts.filter((i) => i.broken).length;
  const fixed = impacts.filter((i) => i.fixed).length;
  return {
    impacts,
    total: impacts.length,
    broken,
    fixed,
    compatible: impacts.length - broken,
  };
}
