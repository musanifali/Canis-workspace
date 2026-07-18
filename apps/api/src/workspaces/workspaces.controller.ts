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
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import type { Request } from "express";
import { TenantGuard, tenantCtxOf } from "../auth/tenant.guard.js";
import { ZodValidationPipe } from "../zod-pipe.js";
import {
  duplicateBodySchema,
  rollbackBodySchema,
  saveWorkspaceBodySchema,
  shareBodySchema,
  visibilityBodySchema,
  WorkspaceRecordDto,
  WorkspaceShareDto,
  WorkspaceSummaryDto,
  WorkspaceVersionDto,
  type DuplicateBody,
  type RollbackBody,
  type SaveWorkspaceBody,
  type ShareBody,
  type VisibilityBody,
} from "./dto.js";
import { WorkspacesService } from "./workspaces.service.js";

const saveBodyPipe = new ZodValidationPipe(saveWorkspaceBodySchema);
const rollbackBodyPipe = new ZodValidationPipe(rollbackBodySchema);
const shareBodyPipe = new ZodValidationPipe(shareBodySchema);
const visibilityBodyPipe = new ZodValidationPipe(visibilityBodySchema);
const duplicateBodyPipe = new ZodValidationPipe(duplicateBodySchema);

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
  @ApiUnprocessableEntityResponse({
    description:
      "Spec is shape-valid but fails server-side contract/policy validation " +
      "(the same validateSpec the renderer uses). Body carries a " +
      "machine-readable `code` (spec_rejected | spec_needs_clarification) " +
      "plus the validator's errors/questions. Nothing is persisted.",
  })
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
  @ApiUnprocessableEntityResponse({
    description:
      "Spec is shape-valid but fails server-side contract/policy validation. " +
      "Body carries a machine-readable `code` plus the validator's " +
      "errors/questions. No new version is persisted.",
  })
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

  @Get(":id/shares")
  @ApiOperation({ summary: "List a workspace's shares (owner only)" })
  @ApiOkResponse({ type: [WorkspaceShareDto] })
  @ApiForbiddenResponse({ description: "Viewable but not owned" })
  async shares(
    @Req() req: Request,
    @Param("id") id: string,
  ): Promise<WorkspaceShareDto[]> {
    return await this.service.shares(tenantCtxOf(req), id);
  }

  @Post(":id/shares")
  @HttpCode(201)
  @ApiOperation({
    summary: "Grant (or change) a user's or team's role (owner only)",
  })
  @ApiCreatedResponse({ type: WorkspaceShareDto })
  @ApiForbiddenResponse({ description: "Viewable but not owned" })
  async share(
    @Req() req: Request,
    @Param("id") id: string,
    @Body(shareBodyPipe) body: ShareBody,
  ): Promise<WorkspaceShareDto> {
    return await this.service.share(tenantCtxOf(req), id, body);
  }

  @Delete(":id/shares/:shareId")
  @HttpCode(204)
  @ApiOperation({ summary: "Revoke a share (owner only)" })
  @ApiForbiddenResponse({ description: "Viewable but not owned" })
  async unshare(
    @Req() req: Request,
    @Param("id") id: string,
    @Param("shareId") shareId: string,
  ): Promise<void> {
    await this.service.unshare(tenantCtxOf(req), id, shareId);
  }

  @Put(":id/visibility")
  @ApiOperation({ summary: "Change visibility: private/team/org (owner only)" })
  @ApiOkResponse({ type: WorkspaceRecordDto })
  @ApiForbiddenResponse({ description: "Viewable but not owned" })
  async setVisibility(
    @Req() req: Request,
    @Param("id") id: string,
    @Body(visibilityBodyPipe) body: VisibilityBody,
  ): Promise<WorkspaceRecordDto> {
    return await this.service.setVisibility(tenantCtxOf(req), id, body);
  }

  @Post(":id/duplicate")
  @HttpCode(201)
  @ApiOperation({
    summary:
      "Copy a viewable workspace into a new one owned by the caller " +
      "(duplicate-and-modify)",
  })
  @ApiCreatedResponse({ type: WorkspaceRecordDto })
  async duplicate(
    @Req() req: Request,
    @Param("id") id: string,
    @Body(duplicateBodyPipe) body: DuplicateBody,
  ): Promise<WorkspaceRecordDto> {
    return await this.service.duplicate(tenantCtxOf(req), id, body);
  }
}
