/**
 * Compare a live database against a backup manifest (#98).
 *
 * Split out of verify-restore.sh on purpose: a check that has never been seen
 * to FAIL is indistinguishable from a check that cannot fail, and this repo has
 * shipped a vacuously-green gate before. As its own entry point this can be
 * pointed at a deliberately-damaged database to prove it complains — see
 * check-manifest.test.sh.
 *
 * Usage: node check-manifest.mjs <manifest.json> <database-url>
 * Exits non-zero, listing every difference, if the database has drifted.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const [manifestPath, databaseUrl] = process.argv.slice(2);
if (!manifestPath || !databaseUrl) {
  console.error("usage: node check-manifest.mjs <manifest.json> <database-url>");
  process.exit(64);
}

/**
 * Exact row counts plus the RLS shape for every non-system table.
 * MUST stay identical to backup.sh's manifest query — if this one is narrower,
 * whatever it omits can vanish without the check noticing.
 */
const INSPECT = `
select coalesce(jsonb_object_agg(key, info), '{}'::jsonb) from (
  select n.nspname || '.' || c.relname as key, jsonb_build_object(
    'rows', (xpath('/row/c/text()',
              query_to_xml(format('select count(*) as c from %I.%I', n.nspname, c.relname),
                           false, true, '')))[1]::text::bigint,
    'rls', c.relrowsecurity,
    'forceRls', c.relforcerowsecurity,
    'policies', (select count(*) from pg_policy p where p.polrelid = c.oid)
  ) as info
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'r'
    and n.nspname not in ('pg_catalog', 'information_schema')
    and n.nspname not like 'pg\\_%'
) t;
`;

const expected = JSON.parse(readFileSync(manifestPath, "utf8"));
const actual = JSON.parse(
  execFileSync("psql", [databaseUrl, "-tA", "-c", INSPECT], { encoding: "utf8" }),
);

const problems = [];
for (const [table, want] of Object.entries(expected.tables)) {
  const got = actual[table];
  if (!got) {
    problems.push(`${table}: MISSING from the restored database`);
    continue;
  }
  if (got.rows !== want.rows) problems.push(`${table}: ${got.rows} rows, expected ${want.rows}`);
  // A restore that drops RLS would hand every tenant everyone else's rows while
  // the row counts stayed perfect — this is the assertion that catches it.
  if (got.rls !== want.rls) problems.push(`${table}: RLS enabled=${got.rls}, expected ${want.rls}`);
  if (got.policies !== want.policies) {
    problems.push(`${table}: ${got.policies} RLS policies, expected ${want.policies}`);
  }
}
const extra = Object.keys(actual).filter((t) => !(t in expected.tables));
if (extra.length) problems.push(`unexpected tables in restore: ${extra.join(", ")}`);

const tables = Object.keys(expected.tables);
const rows = Object.values(expected.tables).reduce((n, t) => n + t.rows, 0);
const policies = Object.values(expected.tables).reduce((n, t) => n + t.policies, 0);

if (problems.length > 0) {
  console.error("\n  RESTORE VERIFICATION FAILED:");
  for (const problem of problems) console.error(`    - ${problem}`);
  console.error("");
  process.exit(1);
}

// An empty manifest would satisfy every assertion above without asserting
// anything. Refuse to call that a pass.
if (tables.length === 0) {
  console.error("\n  REFUSING TO PASS: the manifest lists no tables — nothing was checked.\n");
  process.exit(1);
}

console.error(
  `\n  VERIFIED against ${manifestPath}:\n` +
    `    ${tables.length} tables · ${rows} rows · ${policies} RLS policies — identical to source.\n`,
);
