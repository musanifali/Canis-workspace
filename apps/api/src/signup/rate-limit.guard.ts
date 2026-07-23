/**
 * Tiny in-memory sliding-window rate limiter for the signup endpoint (#91 AC:
 * "idempotent + rate-limited"). No external dependency and no shared store: a
 * single service instance is the launch target, and signup is low-volume, so a
 * per-process Map is enough. Horizontal scale-out would move this to Redis —
 * noted as a follow-up on the card, not built now.
 *
 * Keyed by the caller-forwarded client IP (`x-forwarded-for` first hop), since
 * the dashboard BFF is the only network peer; falls back to the socket IP.
 */
import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import type { Request } from "express";

const WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const MAX_IN_WINDOW = 10; // signups per client IP per window

function clientKey(req: Request): string {
  const fwd = req.header("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.ip ?? "unknown";
}

@Injectable()
export class SignupRateLimitGuard implements CanActivate {
  // key → ascending list of hit timestamps still inside the window.
  private readonly hits = new Map<string, number[]>();

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const key = clientKey(req);
    const now = Date.now();
    const cutoff = now - WINDOW_MS;

    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (recent.length >= MAX_IN_WINDOW) {
      const retryAfterSec = Math.ceil((recent[0]! + WINDOW_MS - now) / 1000);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          code: "signup_rate_limited",
          message: "too many signup attempts; try again later",
          retryAfterSeconds: retryAfterSec,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}
