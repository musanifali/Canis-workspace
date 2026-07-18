# Changesets

Every user-visible change to the public packages (`core`, `react`, `ui`,
`client`, `cli`, `devtools`) lands with a changeset: `npm run changeset`,
pick the bump per semver as defined in `devdocs/release-policy.md`, describe
the change from the vendor's point of view.

The six public packages version together (fixed group); the release workflow
turns accumulated changesets into a version commit + a single `vX.Y.Z` git
tag — the semver source of truth (packages are not npm-published; see
release-policy.md decision D4). Canary tarballs are packed from every main
build.
