/**
 * Health endpoints for the uptime prober + orchestrator (#97). Outside the
 * /v1 prefix and unauthenticated so a black-box prober can hit them:
 *  - GET /health        liveness — the process is up (never touches the DB).
 *  - GET /health/ready  readiness — a 1-query DB round-trip; 503 if the pool
 *                       is unreachable, so a bad deploy fails its readiness gate
 *                       instead of taking traffic.
 */
import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { WorkspaceDbClient } from "@workspace-engine/db";
import { DB_CLIENT } from "../db.provider.js";
import { RELEASE } from "./release.js";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(@Inject(DB_CLIENT) private readonly client: WorkspaceDbClient) {}

  @Get()
  @ApiOperation({ summary: "Liveness — process is up (no dependencies checked)" })
  live(): { status: "ok"; release: string } {
    return { status: "ok", release: RELEASE };
  }

  @Get("ready")
  @ApiOperation({ summary: "Readiness — dependencies (DB) reachable" })
  async ready(): Promise<{ status: "ok"; release: string; checks: { db: "ok" } }> {
    try {
      await this.client.pool.query("select 1");
    } catch {
      throw new ServiceUnavailableException({
        status: "unavailable",
        release: RELEASE,
        checks: { db: "unreachable" },
      });
    }
    return { status: "ok", release: RELEASE, checks: { db: "ok" } };
  }
}
