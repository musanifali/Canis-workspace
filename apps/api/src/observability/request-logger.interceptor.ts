/**
 * Structured request logging (#97). One JSON line per request to stdout — the
 * container log driver ships it. Deliberately logs only routing/timing
 * metadata plus the tenant id (ADR-4 posture): NEVER spec contents, row data,
 * request bodies, or raw keys. This is what makes "grep a day of logs finds no
 * customer content" true by construction.
 */
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { Observable, tap } from "rxjs";
import { TENANT_CTX } from "../auth/tenant.guard.js";
import { RELEASE } from "./release.js";

interface TenantSlot {
  [TENANT_CTX]?: { tenantId?: string };
}

@Injectable()
export class RequestLoggerInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") return next.handle();
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const start = process.hrtime.bigint();
    // Correlation id: honor an upstream one, else mint. Echoed on the response.
    const requestId = (req.header("x-request-id") ?? randomUUID()).slice(0, 64);
    res.setHeader("x-request-id", requestId);

    const emit = (status: number) => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      // tenant id is attached by TenantGuard; absent on public routes.
      const tenantId = (req as Request & TenantSlot)[TENANT_CTX]?.tenantId;
      // Route pattern (not the raw url) so ids in the path never leak here.
      const route =
        (req.route as { path?: string } | undefined)?.path ?? req.path;
      process.stdout.write(
        JSON.stringify({
          level: status >= 500 ? "error" : "info",
          msg: "request",
          method: req.method,
          route,
          status,
          durationMs: Math.round(durationMs * 10) / 10,
          tenantId: tenantId ?? null,
          requestId,
          release: RELEASE,
          time: new Date().toISOString(),
        }) + "\n",
      );
    };

    return next.handle().pipe(
      tap({
        next: () => emit(res.statusCode),
        // On a thrown error the status isn't set on res yet; the exception
        // filter logs the error detail, this records the request completed.
        error: (err: { status?: number }) => emit(err?.status ?? 500),
      }),
    );
  }
}
