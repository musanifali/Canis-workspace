#!/usr/bin/env bash
#
# Seal a verified bundle into a single encrypted archive (#98).
#
# Encryption is PUBLIC-KEY (age), not a shared passphrase, and that asymmetry is
# the point: the backup job holds only the recipient's public key, so a runner —
# or anyone who compromises one, or reads a leaked secret — can create backups
# but cannot read a single one. The private identity never enters CI.
#
# The obvious corollary, stated plainly because it is the sharpest edge here:
# LOSE THE IDENTITY AND EVERY BACKUP IS PERMANENTLY UNREADABLE. Nobody can
# recover it — not us, not GitHub, not Render. See the runbook.
#
# Env: BUNDLE_DIR, OUT_FILE, RECIPIENT (an age public key)
set -euo pipefail
: "${BUNDLE_DIR:?}" "${OUT_FILE:?}" "${RECIPIENT:?}"

# -C so the archive holds bare filenames, not the runner's temp paths.
tar -cf - -C "$BUNDLE_DIR" . | gzip -9 | age --recipient "$RECIPIENT" --output "$OUT_FILE"

printf '  sealed → %s (%s)\n' "$OUT_FILE" "$(du -h "$OUT_FILE" | cut -f1)" >&2
