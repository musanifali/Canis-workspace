import { SpecParseError } from "@workspace-engine/core";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { WorkspaceDbClient } from "../client.js";
import { workspaceVersions } from "../schema.js";
import { withTenant, type TenantContext } from "../tenant.js";
import {
  buildVerdict,
  connectTestDb,
  createTestTenant,
  specFixture,
} from "../test-helpers.js";
import { listAuditEntries } from "./audit.js";
import {
  createWorkspace,
  getWorkspace,
  listWorkspaces,
  softDeleteWorkspace,
  updateWorkspaceSpec,
  WorkspaceNotFoundError,
} from "./workspaces.js";

let client: WorkspaceDbClient;
let ctx: TenantContext;

beforeAll(async () => {
  client = await connectTestDb();
  ({ ctx } = await createTestTenant(client));
});

afterAll(async () => {
  await client?.close();
});

describe("createWorkspace", () => {
  it("creates the workspace, version 1, and an audit entry in one transaction", async () => {
    const spec = specFixture("Board one");
    const { workspace, head } = await withTenant(client.db, ctx, (tx) =>
      createWorkspace(tx, ctx, {
        spec,
        verdict: buildVerdict,
        prompt: "cases grouped by analyst",
        createdFromThreadId: "thread_abc123",
      }),
    );

    expect(workspace.title).toBe("Board one");
    expect(workspace.headVersion).toBe(1);
    expect(workspace.ownerUserId).toBe(ctx.userId);
    expect(workspace.visibility).toBe("private");
    expect(workspace.createdFromThreadId).toBe("thread_abc123");
    expect(head.versionNumber).toBe(1);
    expect(head.spec).toEqual(spec);
    expect(head.specVersion).toBe(1);
    expect(head.prompt).toBe("cases grouped by analyst");
    expect(head.verdict).toEqual(buildVerdict);
    expect(head.authorUserId).toBe(ctx.userId);

    const audit = await withTenant(client.db, ctx, (tx) =>
      listAuditEntries(tx, { workspaceId: workspace.id }),
    );
    expect(audit.map((entry) => entry.action)).toEqual(["workspace.created"]);
  });

  it("stores a detached copy of the spec", async () => {
    const spec = specFixture("Detached");
    const { workspace } = await withTenant(client.db, ctx, (tx) =>
      createWorkspace(tx, ctx, { spec, verdict: buildVerdict }),
    );
    spec.title = "Mutated after save";

    const { head } = await withTenant(client.db, ctx, (tx) =>
      getWorkspace(tx, ctx, workspace.id),
    );
    expect(head.spec.title).toBe("Detached");
  });

  it("rejects a shape-invalid spec at the persistence boundary", async () => {
    const broken = { ...specFixture(), blocks: [] };
    await expect(
      withTenant(client.db, ctx, (tx) =>
        createWorkspace(tx, ctx, {
          spec: broken as never,
          verdict: buildVerdict,
        }),
      ),
    ).rejects.toThrow(SpecParseError);
  });
});

describe("getWorkspace / listWorkspaces", () => {
  it("throws WorkspaceNotFoundError for unknown ids", async () => {
    await expect(
      withTenant(client.db, ctx, (tx) => getWorkspace(tx, ctx, "ws_nope")),
    ).rejects.toThrow(WorkspaceNotFoundError);
  });

  it("lists live workspaces most recently updated first", async () => {
    const { ctx: freshCtx } = await createTestTenant(client, "List Tenant");
    const first = await withTenant(client.db, freshCtx, (tx) =>
      createWorkspace(tx, freshCtx, {
        spec: specFixture("First"),
        verdict: buildVerdict,
      }),
    );
    const second = await withTenant(client.db, freshCtx, (tx) =>
      createWorkspace(tx, freshCtx, {
        spec: specFixture("Second"),
        verdict: buildVerdict,
      }),
    );
    // Touch the first so it becomes most recent.
    await withTenant(client.db, freshCtx, (tx) =>
      updateWorkspaceSpec(tx, freshCtx, first.workspace.id, {
        spec: specFixture("First updated"),
        verdict: buildVerdict,
      }),
    );

    const listed = await withTenant(client.db, freshCtx, (tx) =>
      listWorkspaces(tx, freshCtx),
    );
    expect(listed.map((w) => w.id)).toEqual([
      first.workspace.id,
      second.workspace.id,
    ]);
  });
});

describe("updateWorkspaceSpec", () => {
  it("appends a new version, repoints head, and re-denormalizes the title", async () => {
    const { workspace } = await withTenant(client.db, ctx, (tx) =>
      createWorkspace(tx, ctx, {
        spec: specFixture("Before edit"),
        verdict: buildVerdict,
      }),
    );

    const updated = await withTenant(client.db, ctx, (tx) =>
      updateWorkspaceSpec(tx, ctx, workspace.id, {
        spec: specFixture("After edit"),
        verdict: buildVerdict,
        prompt: "rename it",
      }),
    );

    expect(updated.workspace.headVersion).toBe(2);
    expect(updated.workspace.title).toBe("After edit");
    expect(updated.head.versionNumber).toBe(2);

    // Both versions exist untouched — edits never rewrite history.
    const versions = await withTenant(client.db, ctx, (tx) =>
      tx
        .select()
        .from(workspaceVersions)
        .where(eq(workspaceVersions.workspaceId, workspace.id)),
    );
    expect(versions.map((v) => v.versionNumber).toSorted()).toEqual([1, 2]);
    expect(
      versions.find((v) => v.versionNumber === 1)?.spec.title,
    ).toBe("Before edit");

    const audit = await withTenant(client.db, ctx, (tx) =>
      listAuditEntries(tx, { workspaceId: workspace.id }),
    );
    expect(audit.map((entry) => entry.action)).toEqual([
      "workspace.updated",
      "workspace.created",
    ]);
  });

  it("throws WorkspaceNotFoundError for unknown ids", async () => {
    await expect(
      withTenant(client.db, ctx, (tx) =>
        updateWorkspaceSpec(tx, ctx, "ws_nope", {
          spec: specFixture(),
          verdict: buildVerdict,
        }),
      ),
    ).rejects.toThrow(WorkspaceNotFoundError);
  });
});

describe("softDeleteWorkspace", () => {
  it("hides the workspace from get/list but keeps versions and audit", async () => {
    const { workspace } = await withTenant(client.db, ctx, (tx) =>
      createWorkspace(tx, ctx, {
        spec: specFixture("Doomed"),
        verdict: buildVerdict,
      }),
    );

    await withTenant(client.db, ctx, (tx) =>
      softDeleteWorkspace(tx, ctx, workspace.id),
    );

    await expect(
      withTenant(client.db, ctx, (tx) => getWorkspace(tx, ctx, workspace.id)),
    ).rejects.toThrow(WorkspaceNotFoundError);

    const listed = await withTenant(client.db, ctx, (tx) => listWorkspaces(tx, ctx));
    expect(listed.map((w) => w.id)).not.toContain(workspace.id);

    const versions = await withTenant(client.db, ctx, (tx) =>
      tx
        .select()
        .from(workspaceVersions)
        .where(eq(workspaceVersions.workspaceId, workspace.id)),
    );
    expect(versions).toHaveLength(1);

    const audit = await withTenant(client.db, ctx, (tx) =>
      listAuditEntries(tx, { workspaceId: workspace.id }),
    );
    expect(audit.map((entry) => entry.action)).toEqual([
      "workspace.deleted",
      "workspace.created",
    ]);
  });

  it("deleting twice throws WorkspaceNotFoundError", async () => {
    const { workspace } = await withTenant(client.db, ctx, (tx) =>
      createWorkspace(tx, ctx, {
        spec: specFixture(),
        verdict: buildVerdict,
      }),
    );
    await withTenant(client.db, ctx, (tx) =>
      softDeleteWorkspace(tx, ctx, workspace.id),
    );
    await expect(
      withTenant(client.db, ctx, (tx) =>
        softDeleteWorkspace(tx, ctx, workspace.id),
      ),
    ).rejects.toThrow(WorkspaceNotFoundError);
  });
});
