# Backup and restore runbook

Production data is 3 tenants, their users, API keys and audit history in a
single Render Postgres. This directory is how it survives a bad migration, a
dropped table, or the database simply going away.

Read this before you need it. The middle of an incident is a bad time to learn
that the restore needs a file you never saved.

---

## The two things that surprise people

**1. Render's free plan takes no backups.** Not "daily" — none. `GET /v1/postgres/{id}/backup`
returns `[]`. Everything here exists because that is the actual starting point.

**2. Production accepts no external connections.** `ipAllowList` is `[]`; the API
reaches the database over Render's internal network. So a backup job cannot just
connect. `backup.sh` opens a window for its own egress IP `/32`, dumps, and closes
it again — with a `trap`, so the window closes on failure, on error, and on
Ctrl-C. It also **refuses to run** if it finds the allowlist non-empty, because
that means either someone opened it deliberately or a previous run failed to
clean up, and neither should be discovered silently.

The resting state of that list is empty. If you ever find it otherwise and don't
know why, treat it as an incident.

---

## What runs, and when

`nightly-backup.yml` in the **private** `musanifali/ticora-backups` repo, at
03:17 UTC daily. Each run:

1. opens the access window, dumps, closes the window;
2. restores the dump into a scratch PostgreSQL 18 database;
3. **asserts the restore matches the source** — every table, exact row counts,
   RLS enabled state, and policy counts;
4. only then seals it with `age` and publishes it as a release asset.

Step 3 is the one that matters. Every archive in that repo has demonstrably come
back at least once. A backup nobody has restored is a hope.

---

## Why encryption is asymmetric

The archives are encrypted to an **age public key** (`recipient.age.pub`, which
is committed here — public keys are public). CI holds only that. It can write
backups and cannot read any.

This means a compromised runner, a leaked `RENDER_API_KEY`, or access to the
private backup repo yields no customer data.

It also means:

> **If the age identity is lost, every backup is permanently unreadable.**
> It is not escrowed anywhere. Keep it in a password manager *and* one offline
> copy.

---

## Restoring

### To a scratch database (the drill — do this quarterly)

```bash
gh release download backup-2026-09-03 --repo musanifali/ticora-backups

IDENTITY=~/ticora-backup-identity.txt \
ARCHIVE=ticora-backup-2026-09-03.tar.age \
TARGET_DATABASE_URL=postgres://postgres:pw@localhost:5432/scratch \
  ./scripts/backup/restore-drill.sh
```

It unseals, verifies checksums, creates roles, restores, and checks the result
against the manifest captured at dump time. It prints timings; put them in the
incident log.

**Measured 2026-09-03**, restoring the published `backup-2026-09-03` archive
(12 tables, 27 rows, 22 RLS policies, 68 KB bundle, 9.6 KB sealed):

| Step | Time |
| --- | --- |
| Download the release asset | ~2s |
| Unseal + checksum + roles + restore + verify | **<1s** |
| Cross-tenant RLS suite against the restored database | 15/15 in 120ms |

Expect this to grow roughly linearly with data. Re-measure at each drill and
update this table — a stale number is worse than none, because someone will
plan an incident around it.

### Proving isolation survived, not just the rows

The manifest check asserts RLS is still enabled with the same policy counts.
To prove isolation actually *holds* on the restored data, point the real
cross-tenant suite at it:

```bash
TEST_DATABASE_URL=postgres://postgres:pw@localhost:5455/prod_drill \
  npx vitest run --root packages/db src/rls.test.ts
```

That is the same 15-assertion probe from #25 — tenant B attempting to read and
write tenant A's rows, denied by Postgres rather than by application politeness.
It passed against the restored database on 2026-09-03.

Note that it also runs `migrate()` first, which no-ops against a correctly
restored database — quiet proof that the migration ledger came back intact.

### Over production

There is no button for this and there should not be. The sequence:

1. **Stop writes.** Scale the API service to zero in Render. A restore under
   live traffic produces a database that matches neither the backup nor what
   users just did.
2. Restore into a *new* database first and verify it — never overwrite the only
   copy of the current state, however broken, until you have the replacement in
   hand and checked.
3. Point `WORKSPACE_DATABASE_URL` at the restored instance (use the **internal**
   connection string).
4. Scale the API back up, then re-run the smoke test from `deploy-api.yml`.

Restoring *into* the existing database instead, if you must, needs
`drop schema public cascade; create schema public;` first — `pg_restore` will
not overwrite existing tables and will otherwise fail object by object.

---

## Why `roles.sql` exists

`pg_dump` does not dump roles; they are cluster-level. Our schema is full of
`GRANT … TO workspace_service` and RLS policies naming that role, so a dump
restored into a fresh cluster fails on the first policy:

```
pg_restore: error: could not execute query: ERROR:  role "workspace_service" does not exist
Command was: CREATE POLICY api_keys_service_select ON public.api_keys FOR SELECT TO workspace_service …
```

That is not hypothetical — it is what happens, and `check-manifest.test.sh`
keeps a case that skips the preamble so the failure stays visible rather than
becoming folklore. `backup.sh` generates the preamble from the roles the
database's own grants and policies actually name.

---

## Retention

14 nightly archives, pruned automatically. At the current size that is under a
megabyte total; the limit is deliberate rather than economic — a shorter window
that is verified daily beats a longer one nobody has ever opened.

There is **no point-in-time recovery**. Worst case, a restore loses up to 24
hours of writes. That is a real limitation and it is stated as such on the
public security page rather than dressed up.

---

## Testing the alert

A backup that fails silently is worse than none, because it buys false
confidence. On failure the workflow opens a `backup-failure` issue in the
private repo (and GitHub emails the owner). To prove that path still works,
run the workflow with a deliberately broken secret:

```bash
gh secret set RENDER_API_KEY --repo musanifali/ticora-backups --body "rnd_invalid"
gh workflow run nightly-backup.yml --repo musanifali/ticora-backups -f reason="alert test"
# expect: run fails, issue opened. Then put the real key back:
gh secret set RENDER_API_KEY --repo musanifali/ticora-backups --body "$REAL_KEY"
```

---

## Files

| File | What it does |
| --- | --- |
| `backup.sh` | Opens the access window, dumps, writes `roles.sql` + `manifest.json`, closes the window |
| `verify-restore.sh` | Restores a bundle into a scratch database and checks it — the gate before publishing |
| `check-manifest.mjs` | The comparison itself; separately runnable so it can be proven to fail |
| `check-manifest.test.sh` | Damages a restored database four ways and asserts each is caught |
| `seal.sh` | `tar` + `gzip` + `age` encrypt to the public recipient |
| `restore-drill.sh` | The human path: sealed archive → working, verified database |
| `recipient.age.pub` | The public half of the backup key. Safe to commit |

---

## Known gap

`sessions` is the one table with RLS disabled and no policies. It is a
dashboard-auth table looked up before a tenant is known, so this may well be
deliberate — but it is recorded in the manifest either way, so a restore that
changed it would be caught. Worth an explicit decision rather than an assumption.
