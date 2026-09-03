#!/usr/bin/env bash
#
# Restore a backup bundle into a scratch database and PROVE it came back (#98).
#
# This runs on every backup, before the bundle is published — so we never store
# a backup that hasn't demonstrated it can be restored. A backup that has never
# been restored is a hope, not a backup; the only honest way to know is to do it.
#
# What "restored correctly" means here, in order of strength:
#   1. every table in the manifest exists                     (structure)
#   2. every table's row count matches EXACTLY                (data)
#   3. RLS is still enabled, with the same policy count       (the security
#      property — a restore that silently drops RLS would hand every tenant
#      everyone else's rows, and row counts alone would not notice)
#
# Env:
#   BUNDLE_DIR            (required) a bundle from backup.sh
#   TARGET_DATABASE_URL   (required) scratch database — WILL BE OVERWRITTEN
#   SKIP_ROLES=1          (optional) skip roles.sql; used by the test that proves
#                         the preamble is load-bearing rather than decorative
set -euo pipefail

: "${BUNDLE_DIR:?BUNDLE_DIR is required}"
: "${TARGET_DATABASE_URL:?TARGET_DATABASE_URL is required}"

log() { printf '  %s\n' "$*" >&2; }
started=$(date +%s)

log "checking bundle integrity"
( cd "$BUNDLE_DIR" && sha256sum -c SHA256SUMS >/dev/null ) \
  || { log "FAIL: bundle checksums do not match — the archive is corrupt"; exit 1; }

if [ "${SKIP_ROLES:-0}" = "1" ]; then
  log "SKIPPING roles.sql (proving it is load-bearing)"
else
  log "applying roles preamble"
  psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$BUNDLE_DIR/roles.sql"
fi

log "restoring dump"
# --exit-on-error is the point: a restore that prints errors and exits 0 is how
# a "successful" backup quietly loses grants and policies.
pg_restore --dbname="$TARGET_DATABASE_URL" --no-owner --exit-on-error "$BUNDLE_DIR/dump.pgc"
restored=$(( $(date +%s) - started ))
log "restore finished in ${restored}s"

log "comparing restored database against the manifest"
node "$(dirname "$0")/check-manifest.mjs" "$BUNDLE_DIR/manifest.json" "$TARGET_DATABASE_URL"
log "restore took ${restored}s"
