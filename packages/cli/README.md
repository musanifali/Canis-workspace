# @ticora/cli

[![npm](https://img.shields.io/npm/v/%40ticora%2Fcli)](https://www.npmjs.com/package/@ticora/cli) [![license](https://img.shields.io/npm/l/%40ticora%2Fcli)](../../LICENSE)

`ticora` — the vendor CLI.

Gate contract changes in CI before they break saved workspaces.

## Install

```sh
npm install @ticora/cli
```

## Use

```sh
npx ticora contracts diff --contracts contracts/shipped.ts
npx ticora contracts lint --contracts contracts/shipped.ts
```

## Docs

- [Quickstart — a validated workspace in under 10 minutes](https://ticora-docs.vercel.app/quickstart)
- [API reference](https://ticora-docs.vercel.app/reference/api)
- [Error taxonomy — BUILD / CLARIFY / REJECT](https://ticora-docs.vercel.app/reference/errors)

Apache-2.0 © The Ticora Authors
