import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";
import { loadConfig } from "./config.js";
import { buildOpenApiDocument } from "./openapi.js";

/**
 * CORS allow-list. A configured value is a comma-separated origin list; unset
 * means open in dev but a hard failure in production (never reflect arbitrary
 * origins from a misconfigured prod deploy).
 * @returns The origin config for enableCors.
 */
function resolveCorsOrigin(): string[] | boolean {
  const configured = process.env.WORKSPACE_CORS_ORIGIN;
  if (configured) {
    return configured
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "WORKSPACE_CORS_ORIGIN must be set in production — refusing to start " +
        "rather than reflect arbitrary cross-origin requests",
    );
  }
  return true; // local dev: open
}

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const app = await NestFactory.create(AppModule.forDatabase(config.databaseUrl));
  // Health endpoints live at the root so a black-box prober hits /health,
  // not /v1/health; everything else is under /v1.
  app.setGlobalPrefix("v1", { exclude: ["health", "health/ready"] });
  app.enableShutdownHooks();
  // Browser clients (the SDK, dashboard, playground) call /v1 cross-origin.
  // Fail CLOSED in production: reflecting an arbitrary origin from a
  // misconfigured deploy is a security hole, so refuse to start until
  // WORKSPACE_CORS_ORIGIN (comma-separated allow-list) is set. Dev stays open.
  app.enableCors({ origin: resolveCorsOrigin() });

  const document = buildOpenApiDocument(app);
  SwaggerModule.setup("v1/docs", app, document, {
    jsonDocumentUrl: "v1/openapi.json",
  });

  await app.listen(config.port);
  console.log(`Workspace Service /v1 listening on :${config.port}`);
}

void bootstrap();
