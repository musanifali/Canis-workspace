import {
  Controller,
  Body,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import { ContractRevivalError, reviveContract } from "@workspace-engine/core";
import {
  getDataContract,
  listDataContracts,
  removeDataContract,
  upsertDataContract,
  withTenant,
  type WorkspaceDbClient,
} from "@workspace-engine/db";
import type { Request } from "express";
import { RequireScope, TenantGuard, tenantCtxOf } from "../auth/tenant.guard.js";
import { DB_CLIENT } from "../db.provider.js";
import { ZodValidationPipe } from "../zod-pipe.js";
import {
  DataContractDto,
  entityNameSchema,
  toContractDto,
  upsertContractBodySchema,
  type UpsertContractBody,
} from "./dto.js";

const upsertBodyPipe = new ZodValidationPipe(upsertContractBodySchema);
const entityNamePipe = new ZodValidationPipe(entityNameSchema);

/**
 * Vendor self-service contract registry. Registering a contract is the
 * tenant-key holder's own power domain: it widens/narrows what THEIR specs
 * may bind (RLS scopes rows; other tenants are untouched). Every mutation
 * lands in the audit log (contract.registered/updated/removed), and a
 * definition is only stored if core's `reviveContract` accepts it — the
 * registry can never hold a contract the save-gate can't enforce.
 */
@ApiTags("contracts")
@ApiHeader({ name: "x-api-key", description: "Tenant API key", required: true })
@ApiHeader({
  name: "x-user-id",
  description: "Acting end user within the tenant",
  required: true,
})
@ApiUnauthorizedResponse({ description: "Missing/unknown API key or user" })
@UseGuards(TenantGuard)
@RequireScope("admin")
@Controller("contracts")
export class ContractsController {
  constructor(
    @Inject(DB_CLIENT) private readonly client: WorkspaceDbClient,
  ) {}

  @Get()
  @ApiOperation({ summary: "List the tenant's registered data contracts" })
  @ApiOkResponse({ type: [DataContractDto] })
  async list(@Req() req: Request): Promise<DataContractDto[]> {
    const ctx = tenantCtxOf(req);
    const rows = await withTenant(this.client.db, ctx, (tx) =>
      listDataContracts(tx),
    );
    return rows.map(toContractDto);
  }

  @Get(":entityName")
  @ApiOperation({ summary: "Fetch one contract by entity name" })
  @ApiOkResponse({ type: DataContractDto })
  @ApiNotFoundResponse({ description: "No contract registered for the entity" })
  async get(
    @Req() req: Request,
    @Param("entityName", entityNamePipe) entityName: string,
  ): Promise<DataContractDto> {
    const ctx = tenantCtxOf(req);
    const row = await withTenant(this.client.db, ctx, (tx) =>
      getDataContract(tx, entityName),
    );
    if (!row) {
      throw new NotFoundException(`no contract registered for "${entityName}"`);
    }
    return toContractDto(row);
  }

  @Put(":entityName")
  @ApiOperation({
    summary:
      "Register or update the entity's contract (serialized defineEntity " +
      "surface — the executable fetch stays vendor-side)",
  })
  @ApiOkResponse({ type: DataContractDto })
  @ApiUnprocessableEntityResponse({
    description:
      "Definition is not a revivable contract, or its `name` does not match " +
      "the path entity. Body carries a machine-readable `code` " +
      "(contract_invalid). Nothing is stored.",
  })
  async upsert(
    @Req() req: Request,
    @Param("entityName", entityNamePipe) entityName: string,
    @Body(upsertBodyPipe) body: UpsertContractBody,
  ): Promise<DataContractDto> {
    const ctx = tenantCtxOf(req);
    this.assertRevivable(entityName, body.definition);
    const row = await withTenant(this.client.db, ctx, (tx) =>
      upsertDataContract(tx, ctx, { entityName, definition: body.definition }),
    );
    return toContractDto(row);
  }

  @Delete(":entityName")
  @HttpCode(204)
  @ApiOperation({ summary: "Remove the entity's contract registration" })
  @ApiNotFoundResponse({ description: "No contract registered for the entity" })
  async remove(
    @Req() req: Request,
    @Param("entityName", entityNamePipe) entityName: string,
  ): Promise<void> {
    const ctx = tenantCtxOf(req);
    const removed = await withTenant(this.client.db, ctx, (tx) =>
      removeDataContract(tx, ctx, entityName),
    );
    if (!removed) {
      throw new NotFoundException(`no contract registered for "${entityName}"`);
    }
  }

  /**
   * Gate storage on core's own revival: what goes in must be exactly what
   * `gateSpec` can pull back out. Also pins the definition's declared name to
   * the path so a registry row can never gate a different entity than it is
   * filed under.
   * @throws {HttpException} 422 `contract_invalid`.
   */
  private assertRevivable(
    entityName: string,
    definition: Record<string, unknown>,
  ): void {
    const status = HttpStatus.UNPROCESSABLE_ENTITY;
    try {
      const revived = reviveContract(definition);
      if (revived.name !== entityName) {
        throw new HttpException(
          {
            statusCode: status,
            code: "contract_invalid",
            message:
              `definition declares entity "${revived.name}" but was sent to ` +
              `"${entityName}"`,
          },
          status,
        );
      }
    } catch (error) {
      if (error instanceof ContractRevivalError) {
        throw new HttpException(
          { statusCode: status, code: "contract_invalid", message: error.message },
          status,
        );
      }
      throw error;
    }
  }
}
