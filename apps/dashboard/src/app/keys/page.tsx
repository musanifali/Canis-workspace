/**
 * API key management (#92): list, mint (scope choice), rotate (guided
 * mint-then-revoke), revoke (with confirm). Owner-only. The raw key of a
 * freshly minted/rotated key is revealed exactly once from a single-use cookie.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactElement } from "react";
import { getSession } from "@/lib/session";
import { listKeys } from "@/lib/keys";
import { unseal } from "@/lib/oauth-state";
import { CopyButton } from "./copy-button";
import { RevokeForm } from "./revoke-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "API keys — Canis" };

export default async function KeysPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}): Promise<ReactElement> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "owner") {
    return (
      <div className="notice">
        <p>Only the workspace owner can manage API keys.</p>
      </div>
    );
  }

  const { error } = await searchParams;
  const jar = await cookies();
  const minted = unseal(jar.get("minted_key")?.value);
  const keys = (await listKeys()) ?? [];

  return (
    <section className="keys">
      <h1>API keys</h1>

      {error ? (
        <p className="signup-error" role="alert">
          {error}
        </p>
      ) : null}

      {minted?.rawKey ? (
        <div className="key-reveal">
          <p>
            <strong>
              {minted.rotated === "1" ? "Rotated key" : "New key"} “{minted.name}”
              ({minted.scope}) — copy it now, it won’t be shown again.
            </strong>
          </p>
          <div className="key-reveal-row">
            <code>{minted.rawKey}</code>
            <CopyButton value={minted.rawKey} />
          </div>
          <form method="POST" action="/api/keys/dismiss">
            <button type="submit" className="key-dismiss">
              I’ve saved it
            </button>
          </form>
        </div>
      ) : null}

      <details className="key-mint">
        <summary>Mint a new key</summary>
        <form method="POST" action="/api/keys/mint" className="key-mint-form">
          <input name="name" placeholder="e.g. ci-runner" required maxLength={60} />
          <select name="scope" defaultValue="runtime">
            <option value="runtime">runtime (browser-adjacent: workspaces + telemetry)</option>
            <option value="admin">admin (contracts, audit, usage, keys)</option>
          </select>
          <button type="submit" className="signup-submit">
            Mint key
          </button>
        </form>
      </details>

      <table className="contracts-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Scope</th>
            <th>Created</th>
            <th>Last used</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => {
            const revoked = k.revokedAt !== null;
            return (
              <tr key={k.id} className={revoked ? "key-revoked" : undefined}>
                <td>
                  <strong>{k.name}</strong>
                </td>
                <td>
                  <span className="pill">{k.scope}</span>
                </td>
                <td>{new Date(k.createdAt).toLocaleDateString()}</td>
                <td>{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : "never"}</td>
                <td>{revoked ? <span className="pill">revoked</span> : "active"}</td>
                <td className="key-actions">
                  {revoked ? null : (
                    <>
                      <form method="POST" action="/api/keys/rotate">
                        <input type="hidden" name="id" value={k.id} />
                        <input type="hidden" name="name" value={k.name} />
                        <input type="hidden" name="scope" value={k.scope} />
                        <button type="submit">Rotate</button>
                      </form>
                      <RevokeForm id={k.id} />
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
