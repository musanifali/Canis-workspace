/**
 * #28's permission matrix, exercised in the operations layer: viewer vs
 * editor vs owner, org visibility, team shares, and duplicate-and-modify.
 * Denials read as not-found when the principal can't view (no existence
 * leak) and as WorkspaceForbiddenError when they can view but lack the right.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { WorkspaceDbClient } from "../client.js";
import { withTenant, type TenantContext } from "../tenant.js";
import {
  buildVerdict,
  connectTestDb,
  createTestTenant,
  specFixture,
} from "../test-helpers.js";
import { WorkspaceForbiddenError } from "./access.js";
import { listAuditEntries } from "./audit.js";
import {
  listWorkspaceShares,
  setWorkspaceVisibility,
  shareWorkspace,
  unshareWorkspace,
} from "./shares.js";
import {
  createWorkspace,
  duplicateWorkspace,
  getWorkspace,
  listWorkspaces,
  softDeleteWorkspace,
  updateWorkspaceSpec,
  WorkspaceNotFoundError,
} from "./workspaces.js";

let client: WorkspaceDbClient;
let owner: TenantContext;
let colleague: TenantContext;

/** Fresh workspace owned by `owner`, private by default. */
async function makeWorkspace(title: string): Promise<string> {
  const created = await withTenant(client.db, owner, (tx) =>
    createWorkspace(tx, owner, { spec: specFixture(title), verdict: buildVerdict }),
  );
  return created.workspace.id;
}

beforeAll(async () => {
  client = await connectTestDb();
  const seeded = await createTestTenant(client, "Sharing Tenant");
  owner = seeded.ctx;
  // Same tenant, different user.
  colleague = { tenantId: seeded.tenantId, userId: `user_colleague_${Date.now()}` };
});

afterAll(async () => {
  await client?.close();
});

describe("private workspaces", () => {
  it("are invisible to other tenant users (not-found, not forbidden)", async () => {
    const id = await makeWorkspace("Private board");
    await expect(
      withTenant(client.db, colleague, (tx) => getWorkspace(tx, colleague, id)),
    ).rejects.toThrow(WorkspaceNotFoundError);

    const listed = await withTenant(client.db, colleague, (tx) =>
      listWorkspaces(tx, colleague),
    );
    expect(listed.map((w) => w.id)).not.toContain(id);
  });
});

describe("org visibility", () => {
  it("grants VIEW to every tenant user, but not edit/delete", async () => {
    const id = await makeWorkspace("Org board");
    await withTenant(client.db, owner, (tx) =>
      setWorkspaceVisibility(tx, owner, id, "org"),
    );

    const seen = await withTenant(client.db, colleague, (tx) =>
      getWorkspace(tx, colleague, id),
    );
    expect(seen.workspace.title).toBe("Org board");

    const listed = await withTenant(client.db, colleague, (tx) =>
      listWorkspaces(tx, colleague),
    );
    expect(listed.map((w) => w.id)).toContain(id);

    await expect(
      withTenant(client.db, colleague, (tx) =>
        updateWorkspaceSpec(tx, colleague, id, {
          spec: specFixture("defaced"),
          verdict: buildVerdict,
        }),
      ),
    ).rejects.toThrow(WorkspaceForbiddenError);

    await expect(
      withTenant(client.db, colleague, (tx) =>
        softDeleteWorkspace(tx, colleague, id),
      ),
    ).rejects.toThrow(WorkspaceForbiddenError);

    const audit = await withTenant(client.db, owner, (tx) =>
      listAuditEntries(tx, { workspaceId: id }),
    );
    expect(audit[0]?.action).toBe("workspace.visibility_changed");
    expect(audit[0]?.detail).toEqual({ from: "private", to: "org" });
  });
});

describe("viewer vs editor shares", () => {
  it("a viewer share grants view only; upgrading to editor grants edit", async () => {
    const id = await makeWorkspace("Shared board");
    await withTenant(client.db, owner, (tx) =>
      shareWorkspace(tx, owner, id, {
        subjectType: "user",
        subjectId: colleague.userId,
        role: "viewer",
      }),
    );

    const seen = await withTenant(client.db, colleague, (tx) =>
      getWorkspace(tx, colleague, id),
    );
    expect(seen.workspace.title).toBe("Shared board");

    await expect(
      withTenant(client.db, colleague, (tx) =>
        updateWorkspaceSpec(tx, colleague, id, {
          spec: specFixture("viewer edit"),
          verdict: buildVerdict,
        }),
      ),
    ).rejects.toThrow(WorkspaceForbiddenError);

    // Re-sharing with editor upgrades the same share row.
    await withTenant(client.db, owner, (tx) =>
      shareWorkspace(tx, owner, id, {
        subjectType: "user",
        subjectId: colleague.userId,
        role: "editor",
      }),
    );
    const edited = await withTenant(client.db, colleague, (tx) =>
      updateWorkspaceSpec(tx, colleague, id, {
        spec: specFixture("editor edit"),
        verdict: buildVerdict,
      }),
    );
    expect(edited.workspace.headVersion).toBe(2);

    // Editors still cannot delete, share, or change visibility.
    await expect(
      withTenant(client.db, colleague, (tx) =>
        softDeleteWorkspace(tx, colleague, id),
      ),
    ).rejects.toThrow(WorkspaceForbiddenError);
    await expect(
      withTenant(client.db, colleague, (tx) =>
        shareWorkspace(tx, colleague, id, {
          subjectType: "user",
          subjectId: "user_mallory",
          role: "editor",
        }),
      ),
    ).rejects.toThrow(WorkspaceForbiddenError);

    const shares = await withTenant(client.db, owner, (tx) =>
      listWorkspaceShares(tx, owner, id),
    );
    expect(shares).toHaveLength(1);
    expect(shares[0]?.role).toBe("editor");
  });

  it("unsharing removes access again", async () => {
    const id = await makeWorkspace("Revocable board");
    const share = await withTenant(client.db, owner, (tx) =>
      shareWorkspace(tx, owner, id, {
        subjectType: "user",
        subjectId: colleague.userId,
        role: "viewer",
      }),
    );
    await withTenant(client.db, owner, (tx) =>
      unshareWorkspace(tx, owner, id, share.id),
    );
    await expect(
      withTenant(client.db, colleague, (tx) => getWorkspace(tx, colleague, id)),
    ).rejects.toThrow(WorkspaceNotFoundError);
  });

  it("team shares grant access to members of that team", async () => {
    const id = await makeWorkspace("Team board");
    await withTenant(client.db, owner, (tx) =>
      shareWorkspace(tx, owner, id, {
        subjectType: "team",
        subjectId: "team_emea",
        role: "viewer",
      }),
    );

    const inTeam: TenantContext = { ...colleague, teamIds: ["team_emea"] };
    const seen = await withTenant(client.db, inTeam, (tx) =>
      getWorkspace(tx, inTeam, id),
    );
    expect(seen.workspace.title).toBe("Team board");

    // Same user without the team membership: nothing.
    await expect(
      withTenant(client.db, colleague, (tx) => getWorkspace(tx, colleague, id)),
    ).rejects.toThrow(WorkspaceNotFoundError);
  });
});

describe("duplicate-and-modify", () => {
  it("a viewer can copy a shared workspace into one they own", async () => {
    const id = await makeWorkspace("Sarah's board");
    await withTenant(client.db, owner, (tx) =>
      shareWorkspace(tx, owner, id, {
        subjectType: "user",
        subjectId: colleague.userId,
        role: "viewer",
      }),
    );

    const copy = await withTenant(client.db, colleague, (tx) =>
      duplicateWorkspace(tx, colleague, id, { title: "EMEA board" }),
    );
    expect(copy.workspace.ownerUserId).toBe(colleague.userId);
    expect(copy.workspace.title).toBe("EMEA board");
    expect(copy.workspace.headVersion).toBe(1);
    expect(copy.workspace.visibility).toBe("private");
    expect(copy.head.spec.blocks).toEqual(
      (await withTenant(client.db, owner, (tx) => getWorkspace(tx, owner, id)))
        .head.spec.blocks,
    );

    // The copy is fully theirs: they can edit it; the source is untouched.
    await withTenant(client.db, colleague, (tx) =>
      updateWorkspaceSpec(tx, colleague, copy.workspace.id, {
        spec: specFixture("EMEA board v2"),
        verdict: buildVerdict,
      }),
    );
    const source = await withTenant(client.db, owner, (tx) =>
      getWorkspace(tx, owner, id),
    );
    expect(source.workspace.headVersion).toBe(1);

    const audit = await withTenant(client.db, colleague, (tx) =>
      listAuditEntries(tx, { workspaceId: copy.workspace.id }),
    );
    expect(audit.map((entry) => entry.action)).toContain("workspace.duplicated");
  });

  it("cannot duplicate a workspace you cannot view", async () => {
    const id = await makeWorkspace("Unshared source");
    await expect(
      withTenant(client.db, colleague, (tx) =>
        duplicateWorkspace(tx, colleague, id),
      ),
    ).rejects.toThrow(WorkspaceNotFoundError);
  });
});
