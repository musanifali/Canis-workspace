import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";
import { loadConfig } from "./config.js";
import { buildOpenApiDocument } from "./openapi.js";

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const app = await NestFactory.create(AppModule.forDatabase(config.databaseUrl));
  // Health endpoints live at the root so a black-box prober hits /health,
  // not /v1/health; everything else is under /v1.
  app.setGlobalPrefix("v1", { exclude: ["health", "health/ready"] });
  app.enableShutdownHooks();
  // Browser clients (the demo SDK) call /v1 cross-origin. Dev default is
  // open; set WORKSPACE_CORS_ORIGIN in any non-local deployment.
  app.enableCors({ origin: process.env.WORKSPACE_CORS_ORIGIN ?? true });

  const document = buildOpenApiDocument(app);
  SwaggerModule.setup("v1/docs", app, document, {
    jsonDocumentUrl: "v1/openapi.json",
  });

  await app.listen(config.port);
  console.log(`Workspace Service /v1 listening on :${config.port}`);
}

void bootstrap();
