/**
 * Member list (#93): the owner sees everyone in the tenant. Non-owners get a
 * clear "owner only" notice — the service enforces this too (403), this is
 * just the friendly UI in front of it.
 */
import { redirect } from "next/navigation";
import type { ReactElement } from "react";
import { getSession, listMembers } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Members — Canis" };

export default async function MembersPage(): Promise<ReactElement> {
  const session = await getSession();
  if (!session) redirect("/login");

  if (session.role !== "owner") {
    return (
      <div className="notice">
        <p>Only the workspace owner can view the member list.</p>
      </div>
    );
  }

  const members = await listMembers();
  return (
    <section>
      <h1>Members</h1>
      <table className="contracts-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
          {(members ?? []).map((m) => (
            <tr key={m.id}>
              <td>
                <strong>{m.name ?? "—"}</strong>
                {m.id === session.userId ? (
                  <span className="pill">you</span>
                ) : null}
              </td>
              <td>{m.email ?? "—"}</td>
              <td>
                <span className="pill">{m.role}</span>
              </td>
              <td>{new Date(m.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
