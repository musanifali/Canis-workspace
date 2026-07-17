import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { resolveApiKey, type TenantContext, type WorkspaceDbClient } from "@workspace-engine/db";
import type { Request } from "express";
import { DB_CLIENT } from "../db.provider.js";

/** Request key the resolved tenant context is stored under. */
export const TENANT_CTX = "tenantCtx";

/**
 * Resolves `x-api-key` → tenant (sha256 lookup, owner connection) and
 * `x-user-id` → acting end user. Runs before every /v1 handler; nothing
 * downstream executes without a TenantContext.
 *
 * The end-user identity is client-supplied here, like the vendored platform's
 * `userKey` mechanism — cryptographic per-user auth is the vendor backend's
 * job (ADR-4) and lands with the demo cutover work, not this guard.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    @Inject(DB_CLIENT) private readonly client: WorkspaceDbClient,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.header("x-api-key");
    if (!apiKey) {
      throw new UnauthorizedException("missing x-api-key header");
    }
    const tenantId = await resolveApiKey(this.client.db, apiKey);
    if (!tenantId) {
      throw new UnauthorizedException("unknown or revoked API key");
    }
    const userId = request.header("x-user-id");
    if (!userId) {
      throw new UnauthorizedException(
        "missing x-user-id header (acting end user)",
      );
    }
    const ctx: TenantContext = { tenantId, userId };
    Object.assign(request, { [TENANT_CTX]: ctx });
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
