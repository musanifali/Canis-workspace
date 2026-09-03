#!/usr/bin/env bash
#
# Take a verifiable backup of the production Postgres (#98).
#
# Two constraints shape this script, and neither is optional:
#
#  1. The production database's `ipAllowList` is EMPTY — it accepts no external
#     connections at all. The API reaches it over Render's internal network. So
#     this script opens a single-/32 window for its own egress IP, dumps, and
#     closes it again. `trap` guarantees the close even on failure or Ctrl-C;
#     a backup job must never be able to leave the database exposed.
#
#  2. `pg_dump` does not dump ROLES — they're cluster-level. Our schema is full
#     of `GRANT … TO workspace_service` and RLS policies naming that role, so a
#     dump restored into a fresh cluster fails on every one of them. The bundle
#     therefore carries a generated `roles.sql` preamble. See verify-restore.sh.
#
# Output: a directory (BUNDLE_DIR) containing
#   roles.sql     CREATE ROLE statements for every role the dump references
#   dump.pgc      pg_dump custom format (compressed, selective restore)
#   manifest.json exact row counts + RLS/policy shape, captured at dump time
#
# Env:
#   RENDER_API_KEY      (required) used to read connection info and cycle the window
#   RENDER_POSTGRES_ID  (required) e.g. dpg-…
#   BUNDLE_DIR          (required) where to write the bundle
#
# The database password is never stored as a secret — it's fetched from the
# Render API at run time, so rotating the database doesn't break the backup.
set -euo pipefail

: "${RENDER_API_KEY:?RENDER_API_KEY is required}"
: "${RENDER_POSTGRES_ID:?RENDER_POSTGRES_ID is required}"
: "${BUNDLE_DIR:?BUNDLE_DIR is required}"

API="https://api.render.com/v1/postgres/${RENDER_POSTGRES_ID}"
AUTH=(-H "Authorization: Bearer ${RENDER_API_KEY}" -H "Content-Type: application/json")

log() { printf '  %s\n' "$*" >&2; }

# --- the window ------------------------------------------------------------
# Restoring [] rather than "whatever was there before" is deliberate: [] is the
# documented resting state (see the runbook). If someone has legitimately opened
# the list, the backup job is not the place to discover that silently — the
# guard below fails loudly instead of trampling it.
existing=$(curl -fsS "${AUTH[@]}" "$API" | jq -c '.ipAllowList // []')
if [ "$existing" != "[]" ]; then
  log "REFUSING: ipAllowList is not empty ($existing)."
  log "Production is expected to accept no external connections. Someone opened"
  log "it, or a previous run failed to clean up. Investigate before backing up."
  exit 2
fi

close_window() {
  local rc=$?
  log "closing access window…"
  # Best-effort but noisy: if this fails the database is left reachable from one
  # IP, which we must not swallow.
  if ! curl -fsS -X PATCH "${AUTH[@]}" -d '{"ipAllowList":[]}' "$API" -o /dev/null; then
    log "!! FAILED TO CLOSE THE ACCESS WINDOW — close it by hand immediately:"
    log "!! Render → ${RENDER_POSTGRES_ID} → Access Control → remove all entries"
    exit 1
  fi
  log "window closed."
  exit $rc
}

EGRESS_IP=$(curl -fsS https://api.ipify.org)
log "opening window for ${EGRESS_IP}/32"
trap close_window EXIT INT TERM
curl -fsS -X PATCH "${AUTH[@]}" \
  -d "{\"ipAllowList\":[{\"cidrBlock\":\"${EGRESS_IP}/32\",\"description\":\"automated backup window\"}]}" \
  "$API" -o /dev/null

# Render applies the rule asynchronously; poll rather than guess a sleep.
PGURL="$(curl -fsS "${AUTH[@]}" "${API}/connection-info" | jq -r '.externalConnectionString')?sslmode=require"
for attempt in $(seq 1 30); do
  if psql "$PGURL" -tAc 'select 1' >/dev/null 2>&1; then break; fi
  [ "$attempt" = 30 ] && { log "window never opened after 30 tries"; exit 1; }
  sleep 2
done
log "connected (window took ~$((attempt * 2))s to apply)"

mkdir -p "$BUNDLE_DIR"

# --- roles preamble --------------------------------------------------------
# Only the roles this database's grants and policies actually name, created as
# NOLOGIN shells. A restore target needs them to exist; it does not need their
# passwords, and we deliberately do not copy credentials into the bundle.
log "writing roles.sql"
psql "$PGURL" -tA -o "$BUNDLE_DIR/roles.sql" <<'SQL'
select string_agg(stmt, E'\n' order by stmt) from (
  select distinct format(
    'DO $$ BEGIN CREATE ROLE %I NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;',
    rolname) as stmt
  from pg_roles
  where rolname not like 'pg\_%'
    and (
      -- roles named by a policy
      oid in (select unnest(polroles) from pg_policy)
      -- roles holding a grant on a public table, or owning one
      or oid in (
        select grantee from (
          select (aclexplode(coalesce(c.relacl, acldefault('r', c.relowner)))).grantee
          from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind in ('r','S')
        ) g
      )
      or oid in (
        select c.relowner from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r','S')
      )
    )
) s;
SQL

# --- manifest --------------------------------------------------------------
# Exact counts, not pg_stat's estimates: this manifest is the assertion the
# restore drill checks against, so an approximation would make the check
# meaningless. query_to_xml lets one statement count every table.
log "writing manifest.json"
psql "$PGURL" -tA -o "$BUNDLE_DIR/manifest.json" <<'SQL'
select jsonb_pretty(jsonb_build_object(
  'capturedAt', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'database', current_database(),
  'serverVersion', current_setting('server_version'),
  -- Every non-system schema, keyed schema-qualified. Checking only `public`
  -- would ignore drizzle.__drizzle_migrations — lose that ledger and the
  -- restored database is unmigratable, while a public-only check still
  -- cheerfully reports success.
  'tables', (
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
        and n.nspname not like 'pg\_%'
    ) t
  )
));
SQL

# --- the dump --------------------------------------------------------------
# Custom format: compressed, and restorable table-by-table when a recovery only
# needs one table back. --no-owner because the restore target won't have Render's
# owner role; grants (which RLS depends on) are deliberately KEPT.
log "dumping…"
pg_dump "$PGURL" --format=custom --compress=9 --no-owner --file="$BUNDLE_DIR/dump.pgc"

( cd "$BUNDLE_DIR" && sha256sum dump.pgc roles.sql manifest.json > SHA256SUMS )
log "bundle ready: $(du -sh "$BUNDLE_DIR" | cut -f1)"
