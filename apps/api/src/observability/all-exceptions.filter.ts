/**
 * Structured error logging (#97). Extends Nest's BaseExceptionFilter so every
 * existing error RESPONSE is unchanged (HttpException bodies pass through) —
 * this only ADDS a structured error log for server faults, tagged with the
 * release and tenant id so a production 500 maps to a version + tenant within
 * one log line. 4xx are expected client errors (the request logger already
 * records them); we only escalate 5xx / unhandled here.
 *
 * A real error tracker (Sentry) is wired by forwarding these same fields from
 * the deploy — DSN is a founder-provided secret, noted on the card.
 */
import { ArgumentsHost, Catch, HttpException } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import type { Request } from "express";
import { TENANT_CTX } from "../auth/tenant.guard.js";
import { RELEASE } from "./release.js";

@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  override catch(exception: unknown, host: ArgumentsHost): void {
    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;

    if (status >= 500) {
      const req = host.switchToHttp().getRequest<Request>();
      const tenantId = (
        req as Request & { [TENANT_CTX]?: { tenantId?: string } }
      )[TENANT_CTX]?.tenantId;
      const err = exception as { message?: string; stack?: string; name?: string };
      process.stdout.write(
        JSON.stringify({
          level: "error",
          msg: "unhandled_exception",
          errorName: err?.name ?? "Error",
          // The message/stack are ours (server code), never request payloads.
          error: err?.message ?? String(exception),
          stack: err?.stack?.split("\n").slice(0, 6).join("\n"),
          route: (req.route as { path?: string } | undefined)?.path ?? req.path,
          method: req.method,
          status,
          tenantId: tenantId ?? null,
          requestId: req.header("x-request-id") ?? null,
          release: RELEASE,
          time: new Date().toISOString(),
        }) + "\n",
      );
    }

    // Preserve the default response mapping (structured HttpException bodies,
    // 500 JSON, etc.) — we only observed, we don't change behavior.
    super.catch(exception, host);
  }
}
