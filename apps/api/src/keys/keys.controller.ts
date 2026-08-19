/**
 * API-key self-management (#92). The whole surface is admin-scope: a runtime
 * key (browser-adjacent) can never list, mint, or revoke keys — it gets a
 * machine-readable 403. Keys are tenant-scoped by the guard's TenantContext, so
 * one tenant can't see or touch another's.
 *
 * Minting runs on the owner connection (createApiKey), like provisioning;
 * listing and revocation are tenant-scoped there too. The raw key is returned
 * exactly once — only its hash is ever stored.
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiHeader,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  type ApiKeyMetadata,
  type WorkspaceDbClient,
} from "@workspace-engine/db";
import type { Request } from "express";
import { RequireScope, TenantGuard, tenantCtxOf } from "../auth/tenant.guard.js";
import { DB_CLIENT } from "../db.provider.js";
import { ZodValidationPipe } from "../zod-pipe.js";
import { ApiKeyDto, MintedKeyDto, mintKeyBodySchema, type MintKeyBody } from "./dto.js";

const mintBodyPipe = new ZodValidationPipe(mintKeyBodySchema);

function toDto(k: ApiKeyMetadata): ApiKeyDto {
  return {
    id: k.id,
    name: k.name,
    scope: k.scope,
    createdAt: k.createdAt.toISOString(),
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    revokedAt: k.revokedAt?.toISOString() ?? null,
  };
}

@ApiTags("keys")
@ApiHeader({ name: "x-api-key", description: "Tenant API key (admin scope)", required: true })
@ApiHeader({ name: "x-user-id", description: "Acting end user", required: true })
@ApiUnauthorizedResponse({ description: "Missing/unknown API key or user" })
@UseGuards(TenantGuard)
@RequireScope("admin")
@Controller("keys")
export class KeysController {
  constructor(@Inject(DB_CLIENT) private readonly client: WorkspaceDbClient) {}

  @Get()
  @ApiOperation({ summary: "List the tenant's API keys (metadata only — never the hash)" })
  @ApiOkResponse({ type: [ApiKeyDto] })
  async list(@Req() request: Request): Promise<ApiKeyDto[]> {
    const { tenantId } = tenantCtxOf(request);
    const keys = await listApiKeys(this.client.db, tenantId);
    return keys.map(toDto);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: "Mint a key — the raw value is returned exactly once" })
  @ApiCreatedResponse({ type: MintedKeyDto })
  async mint(
    @Req() request: Request,
    @Body(mintBodyPipe) body: MintKeyBody,
  ): Promise<MintedKeyDto> {
    const { tenantId } = tenantCtxOf(request);
    const created = await createApiKey(this.client.db, {
      tenantId,
      name: body.name,
      scope: body.scope,
    });
    const [meta] = (await listApiKeys(this.client.db, tenantId)).filter(
      (k) => k.id === created.id,
    );
    return { ...toDto(meta!), rawKey: created.rawKey };
  }

  @Delete(":id")
  @HttpCode(204)
  @ApiOperation({ summary: "Revoke a key (tenant-scoped; idempotent)" })
  @ApiNotFoundResponse({ description: "No live key with that id in this tenant" })
  async revoke(@Req() request: Request, @Param("id") id: string): Promise<void> {
    const { tenantId } = tenantCtxOf(request);
    const revoked = await revokeApiKey(this.client.db, { keyId: id, tenantId });
    if (!revoked) {
      throw new NotFoundException({
        statusCode: 404,
        code: "key_not_found",
        message: "no live key with that id in this tenant",
      });
    }
  }
}
