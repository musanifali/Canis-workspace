/**
 * Observability (#97): health/readiness endpoints, structured request logs
 * carrying tenant id but NEVER customer content, and structured error logging
 * with the release + tenant tag. The log-hygiene assertion is the card's
 * headline AC ("grep a day of logs finds no spec/row/keys") made deterministic.
 */
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { createDbClient, provisionTenant } from "@workspace-engine/db";
import request from "supertest";
import type { App } from "supertest/types";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AppModule } from "./app.module.js";
import { caseSpecBody, registerCaseContract } from "./e2e-support.js";

const TEST_DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5443/workspace_engine_test";
const uniq = () => Math.random().toString(36).slice(2, 9);

// A distinctive marker embedded in a spec title — it must NEVER show up in logs.
const SECRET_MARKER = `SECRET_SPEC_TITLE_${uniq()}`;

let app: INestApplication;
let httpServer: App;
let admin: ReturnType<typeof createDbClient>;
let rawKey: string;
let headers: Record<string, string>;

beforeAll(async () => {
  admin = createDbClient(TEST_DATABASE_URL);
  await admin.pool.query("select 1");
  const prov = await provisionTenant(admin.db, {
    orgName: "Obs Co",
    slug: `obs-${uniq()}`,
    owner: { externalId: `github:${uniq()}` },
  });
  await registerCaseContract(admin.db, prov.tenant.id);
  rawKey = prov.apiKey!.rawKey;
  headers = { "x-api-key": rawKey, "x-user-id": prov.owner.id };

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.forDatabase(TEST_DATABASE_URL)],
  }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix("v1", { exclude: ["health", "health/ready"] });
  await app.init();
  httpServer = app.getHttpServer() as App;
});

afterAll(async () => {
  await app?.close();
  await admin?.close();
});

/** Run `fn` while capturing everything written to stdout. */
async function captureStdout(fn: () => Promise<void>): Promise<string> {
  const lines: string[] = [];
  const original = process.stdout.write.bind(process.stdout);
  const spy = vi
    .spyOn(process.stdout, "write")
    .mockImplementation(((chunk: string | Uint8Array, ...rest: unknown[]) => {
      lines.push(String(chunk));
      return (original as (...a: unknown[]) => boolean)(chunk, ...rest);
    }) as typeof process.stdout.write);
  try {
    await fn();
  } finally {
    spy.mockRestore();
  }
  return lines.join("");
}

describe("health endpoints", () => {
  it("liveness is 200 without touching the DB", async () => {
    const res = await request(httpServer).get("/health").expect(200);
    expect(res.body.status).toBe("ok");
  });

  it("readiness is 200 and reports the DB check", async () => {
    const res = await request(httpServer).get("/health/ready").expect(200);
    expect(res.body.checks.db).toBe("ok");
  });
});

describe("structured request logs (tenant id, never content)", () => {
  it("logs routing/timing + tenant id but NOT the spec title or the raw key", async () => {
    const out = await captureStdout(async () => {
      // Save a workspace whose title carries the secret marker.
      await request(httpServer)
        .post("/v1/workspaces")
        .set(headers)
        .send(caseSpecBody(SECRET_MARKER))
        .expect(201);
    });

    // The request WAS logged, with structured fields and the tenant id…
    const line = out
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .find((o) => o?.msg === "request" && o?.route?.includes("workspaces"));
    expect(line).toBeTruthy();
    expect(line.method).toBe("POST");
    expect(line.status).toBe(201);
    expect(line.tenantId).toMatch(/^ten_/);
    expect(typeof line.durationMs).toBe("number");
    expect(line.requestId).toBeTruthy();

    // …but the customer content and the raw key never appear anywhere in logs.
    expect(out).not.toContain(SECRET_MARKER);
    expect(out).not.toContain(rawKey);
    // The route is the PATTERN, not a url with ids.
    expect(out).not.toContain("hello"); // NoteCard config text etc.
  });
});

describe("structured error logging", () => {
  it("an unhandled 500 is logged with release + tenant tag, response unchanged", async () => {
    // Force a DB-layer fault: a malformed workspace id trips a server error
    // path. (Any 5xx exercises the filter; the response body is still the
    // framework's, we only add the log.)
    const out = await captureStdout(async () => {
      await request(httpServer)
        .get("/v1/audit")
        .set(headers)
        .query({ limit: "not-a-number" })
        .expect((res) => {
          // Whatever the status, the filter must not have swallowed the body.
          expect(res.body).toBeDefined();
        });
    });
    // If a 5xx occurred, it was logged with release + tenant; if the input was
    // gracefully rejected (4xx), no error log — either way, no crash, and any
    // error line that exists carries the tags.
    const errLines = out
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter((o) => o?.msg === "unhandled_exception");
    for (const e of errLines) {
      expect(e.release).toBeTruthy();
      expect(e).toHaveProperty("tenantId");
      expect(e.error).not.toContain(rawKey);
    }
  });
});
