/**
 * Zero-dependency argv parsing. Supports `--flag value`, `--flag=value`, and
 * boolean flags (`--json`, `--help`). Positionals collect the subcommand path
 * (e.g. `contracts diff`). We avoid a CLI framework dependency to keep this
 * package's footprint minimal — it ships to vendors' CI.
 */
export interface ParsedArgs {
  positionals: string[];
  options: Record<string, string>;
  flags: Set<string>;
}

const KNOWN_BOOLEAN_FLAGS = new Set(["json", "help"]);

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const positionals: string[] = [];
  const options: Record<string, string> = {};
  const flags = new Set<string>();

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }
    const body = token.slice(2);
    const eq = body.indexOf("=");
    if (eq >= 0) {
      options[body.slice(0, eq)] = body.slice(eq + 1);
      continue;
    }
    if (KNOWN_BOOLEAN_FLAGS.has(body)) {
      flags.add(body);
      continue;
    }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      // A lone `--foo` with no value is treated as a boolean flag.
      flags.add(body);
    } else {
      options[body] = next;
      i++;
    }
  }

  return { positionals, options, flags };
}

/** Resolve an option from flags then a chain of env var names. */
export function resolveOption(
  parsed: ParsedArgs,
  optionName: string,
  env: Record<string, string | undefined>,
  envNames: readonly string[] = [],
): string | undefined {
  if (parsed.options[optionName] !== undefined) return parsed.options[optionName];
  for (const name of envNames) {
    if (env[name] !== undefined && env[name] !== "") return env[name];
  }
  return undefined;
}
