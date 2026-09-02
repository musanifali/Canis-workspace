# @ticora/core

[![npm](https://img.shields.io/npm/v/%40ticora%2Fcore)](https://www.npmjs.com/package/@ticora/core) [![license](https://img.shields.io/npm/l/%40ticora%2Fcore)](../../LICENSE)

Workspace Spec v1 schemas, the validator, and pure helpers.

The single source of truth for what a workspace *is*. Zero IO — no React, no DB, no fetch.

## Install

```sh
npm install @ticora/core
```

## Use

```ts
import { validateSpec, defineEntity } from "@ticora/core";

const verdict = validateSpec(candidateSpec, { contracts: { case: caseContract } });
if (verdict.verdict === "BUILD") render(verdict.spec);
// else: CLARIFY (ask one question) or REJECT (explain, in the contract's terms)
```

## Docs

- [Quickstart — a validated workspace in under 10 minutes](https://ticora-docs.vercel.app/quickstart)
- [API reference](https://ticora-docs.vercel.app/reference/api)
- [Error taxonomy — BUILD / CLARIFY / REJECT](https://ticora-docs.vercel.app/reference/errors)

Apache-2.0 © The Ticora Authors
