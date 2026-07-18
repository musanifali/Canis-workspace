/**
 * `canis` command dispatch. `run(argv, io)` is pure-ish: all side effects go
 * through the injected `io`, and it returns an exit code instead of calling
 * process.exit — so the whole CLI is testable end-to-end without spawning a
 * process. Exit codes: 0 ok, 1 CI-gating (workspaces broken / lint errors),
 * 2 usage error.
 */
import { loadContractModule, toContractMap, ContractLoadError } from "./contracts/load.js";
import { diffContracts } from "./contracts/static-diff.js";
import { lintContracts, hasLintErrors, type LintFinding } from "./contracts/lint.js";
import { analyzeBreakingChanges } from "./diff/analyze.js";
import { loadSpecsFromDir, loadSpecsFromService, type LoadedSpec } from "./specs/load.js";
import { parseArgs, resolveOption, type ParsedArgs } from "./args.js";
import {
  formatDiffHuman,
  diffJson,
  formatLintHuman,
  lintJson,
} from "./report.js";

export interface CliIo {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
  env: Record<string, string | undefined>;
  cwd: string;
}

const USAGE = `canis — Workspace Engine vendor CLI

Usage:
  canis contracts diff  --old <module> --new <module> [--specs-dir <dir> | --service-url <url>] [--json]
  canis contracts lint  --contracts <module> [--json]

contracts diff — does a contract change break saved workspaces?
  --old <module>       Baseline (currently shipped) contract module
  --new <module>       Proposed contract module
  --specs-dir <dir>    Directory of *.json saved specs (air-gapped / testable)
  --service-url <url>  Workspace Service origin        (env WORKSPACE_SERVICE_URL)
  --api-key <key>      Tenant API key                  (env CANIS_API_KEY)
  --user-id <id>       Acting user within the tenant   (env CANIS_USER_ID)
  --json               Machine-readable output
  Exit: non-zero when >=1 saved workspace breaks.

contracts lint — static contract-quality checks
  --contracts <module> Contract module to lint
  --json               Machine-readable output
  Exit: non-zero when >=1 error-severity finding.

A "contract module" is any JS/ESM module exporting EntityContracts built with
defineEntity (named exports, an array export, or the default export).`;

function fail(io: CliIo, message: string): number {
  io.stderr(`error: ${message}`);
  return 2;
}

export async function run(argv: readonly string[], io: CliIo): Promise<number> {
  const parsed = parseArgs(argv);

  if (parsed.flags.has("help") && parsed.positionals.length === 0) {
    io.stdout(USAGE);
    return 0;
  }
  const [group, sub] = parsed.positionals;

  if (group !== "contracts") {
    io.stderr(USAGE);
    return group === undefined ? 0 : fail(io, `unknown command "${group ?? ""}"`);
  }
  if (sub === "diff") return runDiff(parsed, io);
  if (sub === "lint") return runLint(parsed, io);

  io.stderr(USAGE);
  return fail(io, `unknown "contracts" subcommand "${sub ?? ""}" (expected diff|lint)`);
}

async function runDiff(parsed: ParsedArgs, io: CliIo): Promise<number> {
  if (parsed.flags.has("help")) {
    io.stdout(USAGE);
    return 0;
  }
  const oldPath = parsed.options.old;
  const newPath = parsed.options.new;
  if (!oldPath || !newPath) {
    return fail(io, "contracts diff requires --old <module> and --new <module>");
  }

  const specsDir = parsed.options["specs-dir"];
  const serviceUrl = resolveOption(parsed, "service-url", io.env, [
    "WORKSPACE_SERVICE_URL",
    "CANIS_SERVICE_URL",
  ]);
  if (!specsDir && !serviceUrl) {
    return fail(
      io,
      "specify a spec source: --specs-dir <dir> or --service-url <url> (with --api-key / --user-id)",
    );
  }
  if (specsDir && serviceUrl) {
    return fail(io, "use either --specs-dir or --service-url, not both");
  }

  // Load contracts (both sets) — a broken module is a hard, CI-gating error.
  let oldContracts, newContracts;
  try {
    oldContracts = await loadContractModule(oldPath, io.cwd);
    newContracts = await loadContractModule(newPath, io.cwd);
  } catch (error) {
    if (error instanceof ContractLoadError) return fail(io, error.message);
    throw error;
  }

  // Load the population of saved specs.
  let specs: LoadedSpec[];
  try {
    if (specsDir) {
      specs = await loadSpecsFromDir(specsDir);
    } else {
      const apiKey = resolveOption(parsed, "api-key", io.env, ["CANIS_API_KEY"]);
      const userId = resolveOption(parsed, "user-id", io.env, ["CANIS_USER_ID"]);
      if (!apiKey || !userId) {
        return fail(
          io,
          "--service-url needs --api-key (env CANIS_API_KEY) and --user-id (env CANIS_USER_ID)",
        );
      }
      specs = await loadSpecsFromService({ baseUrl: serviceUrl!, apiKey, userId });
    }
  } catch (error) {
    return fail(io, `failed to load specs: ${error instanceof Error ? error.message : String(error)}`);
  }

  const contractDiff = diffContracts(oldContracts, newContracts);
  const analysis = analyzeBreakingChanges(
    specs,
    toContractMap(oldContracts),
    toContractMap(newContracts),
  );

  const meta = {
    baseline: oldPath,
    proposed: newPath,
    source: specsDir ? `dir:${specsDir}` : `service:${serviceUrl}`,
  };

  if (parsed.flags.has("json")) {
    io.stdout(JSON.stringify(diffJson(analysis, contractDiff, meta), null, 2));
  } else {
    io.stdout(formatDiffHuman(analysis, contractDiff, meta));
  }

  return analysis.broken > 0 ? 1 : 0;
}

async function runLint(parsed: ParsedArgs, io: CliIo): Promise<number> {
  if (parsed.flags.has("help")) {
    io.stdout(USAGE);
    return 0;
  }
  const contractsPath = parsed.options.contracts;
  if (!contractsPath) {
    return fail(io, "contracts lint requires --contracts <module>");
  }

  let findings: LintFinding[];
  let entityCount: number;
  try {
    const contracts = await loadContractModule(contractsPath, io.cwd);
    entityCount = contracts.length;
    findings = lintContracts(contracts);
  } catch (error) {
    if (error instanceof ContractLoadError) {
      // A module that fails to load (e.g. defineEntity threw on a bad
      // capability) is itself an error-severity lint result, not a crash.
      findings = [
        {
          entity: "(module)",
          severity: "error",
          code: "contract_load_failed",
          message: error.message,
        },
      ];
      entityCount = 0;
    } else {
      throw error;
    }
  }

  const meta = { contracts: contractsPath, entityCount };
  if (parsed.flags.has("json")) {
    io.stdout(JSON.stringify(lintJson(findings, meta), null, 2));
  } else {
    io.stdout(formatLintHuman(findings, meta));
  }

  return hasLintErrors(findings) ? 1 : 0;
}
