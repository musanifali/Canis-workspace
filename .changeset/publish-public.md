---
"@ticora/core": patch
"@ticora/react": patch
"@ticora/ui": patch
"@ticora/client": patch
"@ticora/cli": patch
"@ticora/devtools": patch
---

Publish the packages publicly.

0.3.0 was published as **restricted**: `changeset publish` passes the `access`
value from `.changeset/config.json`, which defaults to `restricted` and
overrides each package's `publishConfig.access`. The packages existed on the
registry but `npm install @ticora/…` returned 404 for everyone. The config is
now `public`, and this release makes the packages publicly installable.
