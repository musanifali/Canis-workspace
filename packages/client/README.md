# @ticora/client

[![npm](https://img.shields.io/npm/v/%40ticora%2Fclient)](https://www.npmjs.com/package/@ticora/client) [![license](https://img.shields.io/npm/l/%40ticora%2Fclient)](../../LICENSE)

Typed client for the hosted Workspace Service.

Save, version, and load workspaces over /v1.

## Install

```sh
npm install @ticora/client
```

## Use

```ts
import { createWorkspaceServiceClient } from "@ticora/client";

const client = createWorkspaceServiceClient({
  baseUrl: "https://ticora-api.onrender.com",
  apiKey: process.env.TICORA_API_KEY!,
  userId: "your-end-user-id",
});
```

## Docs

- [Quickstart — a validated workspace in under 10 minutes](https://ticora-docs.vercel.app/quickstart)
- [API reference](https://ticora-docs.vercel.app/reference/api)
- [Error taxonomy — BUILD / CLARIFY / REJECT](https://ticora-docs.vercel.app/reference/errors)

Apache-2.0 © The Ticora Authors
