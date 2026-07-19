import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  resolveApiKey,
  type ApiKeyScope,
  type TenantContext,
  type WorkspaceDbClient,
} from "@workspace-engine/db";
import type { Request } from "express";
import { DB_CLIENT } from "../db.provider.js";

/** Request key the resolved tenant context is stored under. */
export const TENANT_CTX = "tenantCtx";
/** Request key the resolved key scope is stored under. */
export const KEY_SCOPE = "keyScope";

const REQUIRED_SCOPE = "requiredKeyScope";

/**
 * Declare the key scope a handler/controller needs ([review][P3]). Undecorated
 * routes accept any live key ("runtime" is enough); `@RequireScope("admin")`
 * routes refuse runtime keys with a machine-readable 403 — an admin key is a
 * dashboard/CLI/CI credential, never a browser-adjacent one.
 */
export const RequireScope = (scope: ApiKeyScope): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_SCOPE, scope);

/**
 * Resolves `x-api-key` → tenant + key scope (sha256 lookup, owner connection)
 * and `x-user-id` → acting end user, then enforces any `@RequireScope`
 * metadata. Runs before every /v1 handler; nothing downstream executes
 * without a TenantContext.
 *
 * The end-user identity is client-supplied here, like the vendored platform's
 * `userKey` mechanism — cryptographic per-user auth is the vendor backend's
 * job (ADR-4) and lands with the demo cutover work, not this guard.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    @Inject(DB_CLIENT) private readonly client: WorkspaceDbClient,
    // Explicit token: this repo compiles without emitDecoratorMetadata.
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.header("x-api-key");
    if (!apiKey) {
      throw new UnauthorizedException("missing x-api-key header");
    }
    const resolved = await resolveApiKey(this.client.db, apiKey);
    if (!resolved) {
      throw new UnauthorizedException("unknown or revoked API key");
    }
    const userId = request.header("x-user-id");
    if (!userId) {
      throw new UnauthorizedException(
        "missing x-user-id header (acting end user)",
      );
    }
    const required = this.reflector.getAllAndOverride<ApiKeyScope | undefined>(
      REQUIRED_SCOPE,
      [context.getHandler(), context.getClass()],
    );
    if (required === "admin" && resolved.scope !== "admin") {
      throw new ForbiddenException({
        statusCode: 403,
        code: "insufficient_key_scope",
        message:
          "this endpoint requires an admin-scope API key; the presented key " +
          `is scope "${resolved.scope}"`,
      });
    }
    // Optional team memberships for team shares (#28), comma-separated.
    const teamIds = (request.header("x-user-teams") ?? "")
      .split(",")
      .map((team) => team.trim())
      .filter((team) => team.length > 0);
    const ctx: TenantContext = { tenantId: resolved.tenantId, userId, teamIds };
    Object.assign(request, { [TENANT_CTX]: ctx, [KEY_SCOPE]: resolved.scope });
    return true;
  }
}

/**
 * Read the TenantContext the guard attached to the request.
 * @returns The tenant context.
 */
export function tenantCtxOf(request: Request): TenantContext {
  const ctx = (request as Request & { [TENANT_CTX]?: TenantContext })[
    TENANT_CTX
  ];
  if (!ctx) {
    throw new Error("TenantGuard did not run before this handler");
  }
  return ctx;
}
