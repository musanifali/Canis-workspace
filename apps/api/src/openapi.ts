import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { OpenAPIObject } from "@nestjs/swagger";

/**
 * The OpenAPI document, generated from the controllers (single source of
 * truth — the typed client's types are generated from this document).
 * @returns The OpenAPI object for the /v1 API.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle("Workspace Service API")
    .setDescription(
      "Durable, multi-tenant, versioned, audited persistence for Workspace " +
        "Spec v1 documents. Versioned at /v1 from day one; see " +
        "API_VERSIONING.md for the deprecation policy.",
    )
    .setVersion("1.0.0")
    .addApiKey({ type: "apiKey", name: "x-api-key", in: "header" }, "apiKey")
    .build();
  return SwaggerModule.createDocument(app, config);
}
