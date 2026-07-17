/**
 * Write the OpenAPI document to apps/api/openapi.json (committed — it is the
 * contract artifact the typed client generates from). Run via `npm run
 * openapi -w @workspace-engine/api`; the e2e suite fails if the committed
 * file drifts from the controllers.
 */
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { AppModule } from "./app.module.js";
import { buildOpenApiDocument } from "./openapi.js";

async function emit(): Promise<void> {
  // The db pool is never used — no request is served — but the module needs
  // a url to construct.
  const app = await NestFactory.create(
    AppModule.forDatabase("postgres://unused:unused@localhost:1/unused"),
    { logger: false },
  );
  app.setGlobalPrefix("v1");
  const document = buildOpenApiDocument(app);
  const out = join(__dirname, "..", "openapi.json");
  writeFileSync(out, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
  console.log(`wrote ${out}`);
}

void emit();
