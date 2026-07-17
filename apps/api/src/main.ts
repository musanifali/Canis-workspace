import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module.js";
import { loadConfig } from "./config.js";
import { buildOpenApiDocument } from "./openapi.js";

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const app = await NestFactory.create(AppModule.forDatabase(config.databaseUrl));
  app.setGlobalPrefix("v1");
  app.enableShutdownHooks();

  const document = buildOpenApiDocument(app);
  SwaggerModule.setup("v1/docs", app, document, {
    jsonDocumentUrl: "v1/openapi.json",
  });

  await app.listen(config.port);
  console.log(`Workspace Service /v1 listening on :${config.port}`);
}

void bootstrap();
