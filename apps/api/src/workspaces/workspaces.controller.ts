import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { Request } from "express";
import { TenantGuard, tenantCtxOf } from "../auth/tenant.guard.js";
import { ZodValidationPipe } from "../zod-pipe.js";
import {
  rollbackBodySchema,
  saveWorkspaceBodySchema,
  WorkspaceRecordDto,
  WorkspaceSummaryDto,
  WorkspaceVersionDto,
  type RollbackBody,
  type SaveWorkspaceBody,
} from "./dto.js";
import { WorkspacesService } from "./workspaces.service.js";

const saveBodyPipe = new ZodValidationPipe(saveWorkspaceBodySchema);
const rollbackBodyPipe = new ZodValidationPipe(rollbackBodySchema);

@ApiTags("workspaces")
@ApiHeader({ name: "x-api-key", description: "Tenant API key", required: true })
@ApiHeader({
  name: "x-user-id",
  description: "Acting end user within the tenant",
  required: true,
})
@ApiUnauthorizedResponse({ description: "Missing/unknown API key or user" })
@UseGuards(TenantGuard)
@Controller("workspaces")
export class WorkspacesController {
  constructor(
    @Inject(WorkspacesService) private readonly service: WorkspacesService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List the tenant's workspaces (no spec payload)" })
  @ApiOkResponse({ type: [WorkspaceSummaryDto] })
  async list(@Req() req: Request): Promise<WorkspaceSummaryDto[]> {
    return await this.service.list(tenantCtxOf(req));
  }

  @Post()
  @ApiOperation({ summary: "Save a new workspace (creates version 1)" })
  @ApiCreatedResponse({ type: WorkspaceRecordDto })
  async create(
    @Req() req: Request,
    @Body(saveBodyPipe) body: SaveWorkspaceBody,
  ): Promise<WorkspaceRecordDto> {
    return await this.service.create(tenantCtxOf(req), body);
  }

  @Get(":id")
  @ApiOperation({ summary: "Fetch a workspace with its head-version spec" })
  @ApiOkResponse({ type: WorkspaceRecordDto })
  @ApiNotFoundResponse({ description: "Unknown or deleted workspace" })
  async get(
    @Req() req: Request,
    @Param("id") id: string,
  ): Promise<WorkspaceRecordDto> {
    return await this.service.get(tenantCtxOf(req), id);
  }

  @Put(":id")
  @ApiOperation({ summary: "Save an edit (appends an immutable version)" })
  @ApiOkResponse({ type: WorkspaceRecordDto })
  @ApiNotFoundResponse({ description: "Unknown or deleted workspace" })
  async update(
    @Req() req: Request,
    @Param("id") id: string,
    @Body(saveBodyPipe) body: SaveWorkspaceBody,
  ): Promise<WorkspaceRecordDto> {
    return await this.service.update(tenantCtxOf(req), id, body);
  }

  @Delete(":id")
  @HttpCode(204)
  @ApiOperation({ summary: "Soft-delete a workspace (history is preserved)" })
  @ApiNotFoundResponse({ description: "Unknown or deleted workspace" })
  async remove(@Req() req: Request, @Param("id") id: string): Promise<void> {
    await this.service.remove(tenantCtxOf(req), id);
  }

  @Get(":id/versions")
  @ApiOperation({ summary: "Version history, newest first" })
  @ApiOkResponse({ type: [WorkspaceVersionDto] })
  @ApiNotFoundResponse({ description: "Unknown or deleted workspace" })
  async versions(
    @Req() req: Request,
    @Param("id") id: string,
  ): Promise<WorkspaceVersionDto[]> {
    return await this.service.versions(tenantCtxOf(req), id);
  }

  @Post(":id/rollback")
  @HttpCode(200)
  @ApiOperation({
    summary: "Point the head at an existing version (no history rewrite)",
  })
  @ApiOkResponse({ type: WorkspaceRecordDto })
  @ApiNotFoundResponse({ description: "Unknown workspace or version" })
  async rollback(
    @Req() req: Request,
    @Param("id") id: string,
    @Body(rollbackBodyPipe) body: RollbackBody,
  ): Promise<WorkspaceRecordDto> {
    return await this.service.rollback(tenantCtxOf(req), id, body.toVersion);
  }
}
