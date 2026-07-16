import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { WorkspaceDbClient } from "../client.js";
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
  getWorkspaceVersion,
  listWorkspaceVersions,
  recordWorkspaceView,
  rollbackWorkspace,
  updateWorkspaceSpec,
  WorkspaceNotFoundError,
  WorkspaceVersionNotFoundError,
} from "./workspaces.js";

let client: WorkspaceDbClient;
let ctx: TenantContext;

beforeAll(async () => {
  client = await connectTestDb();
  ({ ctx } = await createTestTenant(client, "Versions Tenant"));
});

afterAll(async () => {
  await client?.close();
});

/** create v1 ("Original") then edit to v2 ("Edited"). */
async function seedTwoVersions() {
  const { workspace } = await withTenant(client.db, ctx, (tx) =>
    createWorkspace(tx, ctx, {
      spec: specFixture("Original"),
      verdict: buildVerdict,
      prompt: "make me a case board",
    }),
  );
  await withTenant(client.db, ctx, (tx) =>
    updateWorkspaceSpec(tx, ctx, workspace.id, {
      spec: specFixture("Edited"),
      verdict: buildVerdict,
      prompt: "rename the board",
    }),
  );
  return workspace.id;
}

describe("rollbackWorkspace", () => {
  it("repoints head at the older version without writing a new one", async () => {
    const id = await seedTwoVersions();

    const rolled = await withTenant(client.db, ctx, (tx) =>
      rollbackWorkspace(tx, ctx, id, 1),
    );
    expect(rolled.workspace.headVersion).toBe(1);
    expect(rolled.workspace.title).toBe("Original");
    expect(rolled.head.versionNumber).toBe(1);

    // No third version appeared — rollback is a pointer move.
    const versions = await withTenant(client.db, ctx, (tx) =>
      listWorkspaceVersions(tx, id),
    );
    expect(versions.map((v) => v.versionNumber)).toEqual([2, 1]);

    // get() now serves the rolled-back spec.
    const { head } = await withTenant(client.db, ctx, (tx) =>
      getWorkspace(tx, id),
    );
    expect(head.spec.title).toBe("Original");

    const audit = await withTenant(client.db, ctx, (tx) =>
      listAuditEntries(tx, { workspaceId: id }),
    );
    expect(audit[0]?.action).toBe("workspace.rolled_back");
    expect(audit[0]?.detail).toEqual({ from: 2, to: 1 });
  });

  it("can roll forward again to the newer version", async () => {
    const id = await seedTwoVersions();
    await withTenant(client.db, ctx, (tx) => rollbackWorkspace(tx, ctx, id, 1));
    const forward = await withTenant(client.db, ctx, (tx) =>
      rollbackWorkspace(tx, ctx, id, 2),
    );
    expect(forward.workspace.headVersion).toBe(2);
    expect(forward.workspace.title).toBe("Edited");
  });

  it("throws WorkspaceVersionNotFoundError for a missing target version", async () => {
    const id = await seedTwoVersions();
    await expect(
      withTenant(client.db, ctx, (tx) => rollbackWorkspace(tx, ctx, id, 99)),
    ).rejects.toThrow(WorkspaceVersionNotFoundError);
  });
});

describe("version history", () => {
  it("every version records prompt, resolved spec, verdict, and author", async () => {
    const id = await seedTwoVersions();

    const v1 = await withTenant(client.db, ctx, (tx) =>
      getWorkspaceVersion(tx, id, 1),
    );
    expect(v1.prompt).toBe("make me a case board");
    expect(v1.spec.title).toBe("Original");
    expect(v1.verdict).toEqual(buildVerdict);
    expect(v1.authorUserId).toBe(ctx.userId);

    const history = await withTenant(client.db, ctx, (tx) =>
      listWorkspaceVersions(tx, id),
    );
    expect(history.map((v) => v.versionNumber)).toEqual([2, 1]);
    expect(history.map((v) => v.prompt)).toEqual([
      "rename the board",
      "make me a case board",
    ]);
  });

  it("listWorkspaceVersions rejects unknown workspaces", async () => {
    await expect(
      withTenant(client.db, ctx, (tx) => listWorkspaceVersions(tx, "ws_nope")),
    ).rejects.toThrow(WorkspaceNotFoundError);
  });
});

describe("recordWorkspaceView", () => {
  it("audits who viewed which head version", async () => {
    const id = await seedTwoVersions();
    await withTenant(client.db, ctx, (tx) => recordWorkspaceView(tx, ctx, id));

    const audit = await withTenant(client.db, ctx, (tx) =>
      listAuditEntries(tx, { workspaceId: id }),
    );
    expect(audit[0]?.action).toBe("workspace.viewed");
    expect(audit[0]?.actorUserId).toBe(ctx.userId);
    expect(audit[0]?.detail).toEqual({ version: 2 });
  });
});

describe("audit records the prompt used", () => {
  it("created/updated entries carry the NL prompt", async () => {
    const id = await seedTwoVersions();
    const audit = await withTenant(client.db, ctx, (tx) =>
      listAuditEntries(tx, { workspaceId: id }),
    );
    const byAction = new Map(audit.map((entry) => [entry.action, entry]));
    expect(byAction.get("workspace.created")?.detail).toMatchObject({
      prompt: "make me a case board",
    });
    expect(byAction.get("workspace.updated")?.detail).toMatchObject({
      prompt: "rename the board",
    });
  });
});
