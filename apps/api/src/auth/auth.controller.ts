/**
 * Dashboard session auth (#93). No TenantGuard — these run before/outside a
 * tenant-key context:
 *  - POST /v1/auth/login   (provision-secret gated) resolve identity → session
 *  - GET  /v1/auth/session (bearer session token)   who am I
 *  - POST /v1/auth/logout  (bearer session token)   server-side revocation
 *  - GET  /v1/auth/members (bearer, owner only)      the tenant's member list
 *
 * Login is BFF-only: the dashboard verifies the GitHub identity via OAuth, then
 * calls this with the provisioning secret. Sessions are server-side rows, so a
 * fresh token is minted each login (no fixation) and logout truly revokes.
 */
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Inject,
  NotFoundException,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import {
  createSession,
  deleteSession,
  getUserByExternalId,
  listTenantMembers,
  resolveSession,
  type SessionUser,
  type WorkspaceDbClient,
} from "@workspace-engine/db";
import { DB_CLIENT } from "../db.provider.js";
import { ZodValidationPipe } from "../zod-pipe.js";
import { verifyProvisionSecret } from "./provision-secret.js";
import {
  loginRequestSchema,
  LoginResponseDto,
  MemberDto,
  SessionUserDto,
  type LoginRequest,
} from "./dto.js";

const loginPipe = new ZodValidationPipe(loginRequestSchema);

/** Pull the session token from an `Authorization: Bearer <token>` header. */
function bearer(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(@Inject(DB_CLIENT) private readonly client: WorkspaceDbClient) {}

  /** Resolve the current session or throw 401. */
  private async requireSession(authorization: string | undefined): Promise<SessionUser> {
    const token = bearer(authorization);
    if (!token) throw new UnauthorizedException("missing session token");
    const user = await resolveSession(this.client.db, token);
    if (!user) throw new UnauthorizedException("invalid or expired session");
    return user;
  }

  @Post("login")
  @HttpCode(200)
  @ApiHeader({ name: "x-provision-secret", required: true })
  @ApiOperation({
    summary:
      "Mint a session for an already-verified identity (BFF-only). 404 if the " +
      "identity has never signed up.",
  })
  @ApiOkResponse({ type: LoginResponseDto })
  async login(
    @Headers("x-provision-secret") provisionSecret: string | undefined,
    @Body(loginPipe) body: LoginRequest,
  ): Promise<LoginResponseDto> {
    verifyProvisionSecret(provisionSecret);

    const user = await getUserByExternalId(this.client.db, body.externalId);
    if (!user) {
      throw new NotFoundException({
        statusCode: 404,
        code: "user_not_found",
        message: "no account for this identity — sign up first",
      });
    }
    const { token, expiresAt } = await createSession(this.client.db, {
      userId: user.id,
      tenantId: user.tenantId,
    });
    return {
      token,
      expiresAt: expiresAt.toISOString(),
      user: {
        userId: user.id,
        tenantId: user.tenantId,
        role: user.role,
        name: user.name,
        email: user.email,
      },
    };
  }

  @Get("session")
  @ApiHeader({ name: "authorization", description: "Bearer <session token>", required: true })
  @ApiOperation({ summary: "Resolve the current session's user, or 401." })
  @ApiOkResponse({ type: SessionUserDto })
  async session(
    @Headers("authorization") authorization: string | undefined,
  ): Promise<SessionUserDto> {
    return await this.requireSession(authorization);
  }

  @Post("logout")
  @HttpCode(204)
  @ApiHeader({ name: "authorization", description: "Bearer <session token>", required: true })
  @ApiOperation({ summary: "Revoke the session server-side (idempotent)." })
  async logout(
    @Headers("authorization") authorization: string | undefined,
  ): Promise<void> {
    const token = bearer(authorization);
    if (token) await deleteSession(this.client.db, token);
  }

  @Get("members")
  @ApiHeader({ name: "authorization", description: "Bearer <session token>", required: true })
  @ApiOperation({ summary: "List the tenant's members (owner only)." })
  @ApiOkResponse({ type: [MemberDto] })
  async members(
    @Headers("authorization") authorization: string | undefined,
  ): Promise<MemberDto[]> {
    const me = await this.requireSession(authorization);
    if (me.role !== "owner") {
      throw new ForbiddenException({
        statusCode: 403,
        code: "owner_only",
        message: "only the tenant owner can view the member list",
      });
    }
    const members = await listTenantMembers(this.client.db, me.tenantId);
    return members.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.role,
      createdAt: m.createdAt.toISOString(),
    }));
  }
}
