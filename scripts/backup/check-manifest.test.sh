#!/usr/bin/env bash
#
# Prove the restore check can FAIL (#98).
#
# The whole backup story rests on check-manifest.mjs. If it were incapable of
# failing, every backup would be certified sound and we would find out otherwise
# only during a real recovery. So: restore a bundle, damage the database in the
# four ways that matter, and assert the checker catches each one.
#
# Env: BUNDLE_DIR, TARGET_DATABASE_URL (scratch — WILL BE OVERWRITTEN)
set -euo pipefail
: "${BUNDLE_DIR:?}" "${TARGET_DATABASE_URL:?}"

here=$(dirname "$0")
pass=0 fail=0

# Asserts the checker rejects a database we have deliberately broken.
expect_failure() {
  local what=$1 sql=$2
  psql "$TARGET_DATABASE_URL" -q -v ON_ERROR_STOP=1 -c "$sql"
  if node "$here/check-manifest.mjs" "$BUNDLE_DIR/manifest.json" "$TARGET_DATABASE_URL" >/dev/null 2>&1; then
    printf '  FAIL  %s — checker reported success on a damaged database\n' "$what"
    fail=$((fail + 1))
  else
    printf '  ok    %s — caught\n' "$what"
    pass=$((pass + 1))
  fi
}

reset() {
  psql "$TARGET_DATABASE_URL" -q -c 'drop schema if exists public cascade' \
                              -c 'drop schema if exists drizzle cascade' \
                              -c 'create schema public' >/dev/null 2>&1
  psql "$TARGET_DATABASE_URL" -q -f "$BUNDLE_DIR/roles.sql" >/dev/null 2>&1
  pg_restore --dbname="$TARGET_DATABASE_URL" --no-owner --exit-on-error "$BUNDLE_DIR/dump.pgc" 2>/dev/null
}

echo "proving the restore check is not vacuous:"

reset
if node "$here/check-manifest.mjs" "$BUNDLE_DIR/manifest.json" "$TARGET_DATABASE_URL" >/dev/null 2>&1; then
  printf '  ok    an intact restore passes\n'; pass=$((pass + 1))
else
  printf '  FAIL  an intact restore should pass but did not\n'; fail=$((fail + 1))
fi

# 1. Missing rows — the obvious loss. A leaf table, so the deletion isn't
#    blocked by the composite FKs that tie tenant-owned rows together.
reset; expect_failure "a deleted row"            "delete from sessions where ctid = (select ctid from sessions limit 1)"
# 2. RLS switched off — row counts stay perfect while tenant isolation is gone.
reset; expect_failure "RLS silently disabled"    "alter table workspaces disable row level security"
# 3. A dropped policy — isolation narrows without any visible data change.
reset; expect_failure "a dropped RLS policy"     "drop policy workspaces_service_select on workspaces"
# 4. A missing table — including the migration ledger outside \`public\`.
reset; expect_failure "a dropped migration ledger" "drop table drizzle.__drizzle_migrations"

echo
printf '  %d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
