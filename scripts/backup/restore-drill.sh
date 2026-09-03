#!/usr/bin/env bash
#
# The human restore: take a sealed archive back to a working database (#98).
#
# This is the script you run at 3am, so it does the whole job — unseal, create
# roles, restore, verify — and prints timings you can put in an incident log.
# Everything it does is what the nightly job already proves works; the only new
# ingredient is the age identity, which is exactly the part that cannot be
# rehearsed by CI (CI has no decryption key, by design).
#
# Usage:
#   IDENTITY=~/ticora-backup-identity.txt \
#   ARCHIVE=ticora-backup-2026-09-03.tar.age \
#   TARGET_DATABASE_URL=postgres://…/scratch \
#   ./restore-drill.sh
#
# TARGET_DATABASE_URL IS OVERWRITTEN. Never point this at production without
# reading the runbook's "restoring over production" section first.
set -euo pipefail
: "${IDENTITY:?path to the age identity file}" \
  "${ARCHIVE:?path to a .tar.age archive}" \
  "${TARGET_DATABASE_URL:?scratch database url — WILL BE OVERWRITTEN}"

here=$(cd "$(dirname "$0")" && pwd)
log() { printf '  %s\n' "$*" >&2; }
started=$(date +%s)

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT   # plaintext dumps must not outlive the drill

log "unsealing $ARCHIVE"
age --decrypt --identity "$IDENTITY" "$ARCHIVE" | gzip -d | tar -xf - -C "$work"

log "checking integrity"
( cd "$work" && sha256sum -c SHA256SUMS >/dev/null ) \
  || { log "FAIL: checksums do not match — this archive is corrupt"; exit 1; }

log "creating roles"
psql "$TARGET_DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$work/roles.sql"

log "restoring"
pg_restore --dbname="$TARGET_DATABASE_URL" --no-owner --exit-on-error "$work/dump.pgc"

log "verifying against the manifest captured at dump time"
node "$here/check-manifest.mjs" "$work/manifest.json" "$TARGET_DATABASE_URL"

log "total elapsed: $(( $(date +%s) - started ))s"
log "captured at: $(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).capturedAt)' "$work/manifest.json")"
