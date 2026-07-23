/**
 * Tenant self-signup (#91) — the one /v1 route with no TenantGuard, because it
 * runs BEFORE a tenant exists. It provisions the tenant, its owner user, and
 * the first admin key on the owner connection (provisionTenant).
 *
 * Trust model: the dashboard BFF runs GitHub OAuth server-side, verifies the
 * user, then calls this endpoint with a shared provisioning secret. So the
 * body is a trusted identity, not browser input; the secret is what keeps the
 * open internet from minting tenants. Rate limiting + the disposable-email
 * guard are defense-in-depth on top.
 */
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Headers,
  HttpCode,
  Inject,
  Post,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
  UseGuards,
} from "@nestjs/common";
import {
  ApiHeader,
  ApiOperation,
  ApiTags,
  ApiCreatedResponse,
} from "@nestjs/swagger";
import {
  InvalidSlugError,
  provisionTenant,
  TenantSlugTakenError,
  type WorkspaceDbClient,
} from "@workspace-engine/db";
import { timingSafeEqual } from "node:crypto";
import { DB_CLIENT } from "../db.provider.js";
import { ZodValidationPipe } from "../zod-pipe.js";
import { isDisposableEmail } from "./disposable-emails.js";
import { SignupRateLimitGuard } from "./rate-limit.guard.js";
import {
  signupRequestSchema,
  SignupResponseDto,
  type SignupRequest,
} from "./dto.js";

const bodyPipe = new ZodValidationPipe(signupRequestSchema);

/** Constant-time compare that also survives length differences. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

@ApiTags("signup")
@Controller("signup")
export class SignupController {
  constructor(@Inject(DB_CLIENT) private readonly client: WorkspaceDbClient) {}

  @Post()
  @HttpCode(201)
  @UseGuards(SignupRateLimitGuard)
  @ApiHeader({
    name: "x-provision-secret",
    description: "Shared bootstrap secret proving the caller is the dashboard",
    required: true,
  })
  @ApiOperation({
    summary:
      "Provision a new tenant + owner user + admin key from a verified " +
      "identity (idempotent on the owner's external id)",
  })
  @ApiCreatedResponse({ type: SignupResponseDto })
  async signup(
    @Headers("x-provision-secret") provisionSecret: string | undefined,
    @Body(bodyPipe) body: SignupRequest,
  ): Promise<SignupResponseDto> {
    const expected = process.env.WORKSPACE_PROVISION_SECRET;
    if (!expected) {
      // Fail closed: never provision without a configured secret.
      throw new ServiceUnavailableException(
        "signup is not configured (WORKSPACE_PROVISION_SECRET unset)",
      );
    }
    if (!provisionSecret || !secretMatches(provisionSecret, expected)) {
      throw new UnauthorizedException("invalid provisioning secret");
    }

    if (isDisposableEmail(body.owner.email)) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        code: "disposable_email",
        message: "disposable email domains are not allowed for signup",
      });
    }

    try {
      const result = await provisionTenant(this.client.db, {
        orgName: body.orgName,
        slug: body.slug,
        owner: {
          externalId: body.owner.externalId,
          email: body.owner.email ?? null,
          name: body.owner.name ?? null,
        },
      });
      return {
        tenantId: result.tenant.id,
        slug: result.tenant.slug,
        orgName: result.tenant.name,
        userId: result.owner.id,
        apiKey: result.apiKey?.rawKey ?? null,
        created: result.created,
      };
    } catch (error) {
      if (error instanceof TenantSlugTakenError) {
        throw new ConflictException({
          statusCode: 409,
          code: error.code,
          message: error.message,
        });
      }
      if (error instanceof InvalidSlugError) {
        throw new BadRequestException({
          statusCode: 400,
          code: error.code,
          message: error.message,
        });
      }
      throw error;
    }
  }
}
